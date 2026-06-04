from decimal import Decimal, InvalidOperation
from datetime import date
from .models import InvoiceNew
from .utils import sanitize_for_json


ERROR = 'error'
WARNING = 'warning'
INFO = 'info'

def check_ocr_status(invoice):
    issues = []

    if invoice.ocr_status == 'failed':
        error_msg = ''
        if invoice.ocr_result and invoice.ocr_result.get('error'):
            error_msg = f': {invoice.ocr_result["error"][:100]}'

        issues.append(_issue(
            field='ocr_status',
            level=ERROR,
            message=f'OCR thất bại{error_msg}',
            suggestion='Vào chi tiết để nhập thủ công hoặc upload lại file'
        ))

    elif invoice.ocr_status == 'processing':
        issues.append(_issue(
            field='ocr_status',
            level=WARNING,
            message='OCR đang xử lý, chưa có dữ liệu',
            suggestion='Chờ OCR hoàn thành rồi kiểm tra lại'
        ))

    elif invoice.ocr_status == 'pending':
        issues.append(_issue(
            field='ocr_status',
            level=INFO,
            message='Chưa được OCR xử lý',
            suggestion='Kích hoạt OCR hoặc nhập thủ công'
        ))

    return issues


def check_empty_detail(invoice):
    issues  = []
    doc_map = {
        'invoice': ('vat_detail', 'hóa đơn'),
        'receipt': ('receipt_detail', 'phiếu thu'),
        'payment': ('payment_detail', 'phiếu chi'),
        'warehouse': ('warehouse_detail', 'phiếu nhập kho'),
    }

    attr, label = doc_map.get(invoice.document_type, (None, 'chứng từ'))

    if not attr:
        return issues

    try:
        detail = getattr(invoice, attr)
        if detail is None:
            raise Exception("No detail")
    except Exception:
        issues.append(_issue(
            field='detail',
            level=ERROR,
            message=f'Chưa có thông tin chi tiết {label}',
            suggestion='Nhập thủ công hoặc chạy lại OCR'
        ))
        return issues

    #Kiểm tra items rỗng cho hóa đơn và phiếu nhập kho
    if invoice.document_type in ['invoice', 'warehouse']:
        items_attr = 'items'
        if hasattr(detail, items_attr):
            items_count = detail.items.count()
            if items_count == 0:
                issues.append(_issue(
                    field='items',
                    level=ERROR,
                    message='Chưa có mặt hàng nào',
                    suggestion='Nhập ít nhất 1 mặt hàng vào danh sách'
                ))

    return issues

def _issue(field, level, message, suggestion=''):
    return {
        'field': field,
        'level': level,
        'message': message,
        'suggestion': suggestion,
    }


def _to_decimal(value):
    try:
        return Decimal(str(value)) if value else None
    except (InvalidOperation, TypeError):
        return None

def check_common(invoice):
    issues = []

    if not invoice.company_id:
        issues.append(_issue(
            field='company',
            level=ERROR,
            message='Thiếu tên công ty/cửa hàng',
            suggestion='Nhập tên công ty hoặc chọn từ danh sách'
        ))

    if not invoice.file:
        issues.append(_issue(
            field='file',
            level=ERROR,
            message='Chưa có file chứng từ đính kèm',
            suggestion='Upload file PDF hoặc ảnh chứng từ'
        ))

    return issues


# CHECK HÓA ĐƠN BÁN LẺ
def check_invoice(detail):
    issues = []
    if not detail:
        issues.append(_issue(
            field='detail',
            level=ERROR,
            message='Chưa có thông tin chi tiết hóa đơn',
            suggestion='Nhập đầy đủ thông tin hóa đơn'
        ))
        return issues

    invoice_date = detail.invoice_date
    if not invoice_date:
        issues.append(_issue(
            field='invoice_date',
            level=ERROR,
            message='Thiếu ngày hóa đơn',
            suggestion='Nhập ngày xuất hóa đơn'
        ))
    elif isinstance(invoice_date, date) and invoice_date > date.today():
        issues.append(_issue(
            field='invoice_date',
            level=ERROR,
            message=f'Ngày hóa đơn ({invoice_date}) là ngày trong tương lai',
            suggestion='Kiểm tra lại ngày trên hóa đơn gốc'
        ))

    if not detail.seller_name or not detail.seller_name.strip():
        issues.append(_issue(
            field='seller_name',
            level=WARNING,
            message='Thiếu tên cửa hàng/người bán',
            suggestion='Nhập tên cửa hàng trên hóa đơn'
        ))

    total = _to_decimal(detail.total_amount)
    if not total:
        issues.append(_issue(
            field='total_amount',
            level=ERROR,
            message='Thiếu tổng tiền',
            suggestion='Nhập tổng tiền trên hóa đơn'
        ))
    elif total <= 0:
        issues.append(_issue(
            field='total_amount',
            level=ERROR,
            message=f'Tổng tiền ({total:,.0f}đ) không hợp lệ',
            suggestion='Tổng tiền phải lớn hơn 0'
        ))

    items = list(detail.items.all()) if hasattr(detail, 'items') else []
    if items:
        issues += _check_items_total(items, total, 'total_amount')
        issues += _check_items_detail(items)

    subtotal = _to_decimal(detail.subtotal)
    tax = _to_decimal(detail.tax_amount)
    discount = _to_decimal(detail.total_discount)

    if subtotal and total:
        expected = subtotal
        if discount:
            expected -= discount
        if tax:
            expected += tax

        diff = abs(expected - total)
        if diff > Decimal('1000'):
            issues.append(_issue(
                field='total_amount',
                level=WARNING,
                message=f'Tổng tiền ({total:,.0f}đ) không khớp với '
                        f'tạm tính - giảm giá + thuế '
                        f'({expected:,.0f}đ)',
                suggestion='Kiểm tra lại các giá trị tạm tính, '
                           'giảm giá và thuế'
            ))

    # ── Tiền thừa ──
    received = _to_decimal(detail.received_amount)
    change   = _to_decimal(detail.change_amount)
    if received and total and change:
        expected_change = received - total
        diff = abs(expected_change - change)
        if diff > Decimal('1000'):
            issues.append(_issue(
                field='change_amount',
                level=WARNING,
                message=f'Tiền thừa ({change:,.0f}đ) không khớp: '
                        f'tiền nhận ({received:,.0f}đ) - '
                        f'tổng tiền ({total:,.0f}đ) '
                        f'= {expected_change:,.0f}đ',
                suggestion='Kiểm tra lại tiền khách đưa và tiền thừa'
            ))

    return issues

# CHECK PHIẾU THU
def check_receipt(detail):
    issues = []
    if not detail:
        issues.append(_issue(
            field='detail',
            level=ERROR,
            message='Chưa có thông tin phiếu thu',
            suggestion='Nhập đầy đủ thông tin phiếu thu'
        ))
        return issues

    if not detail.receipt_date:
        issues.append(_issue(
            field='receipt_date',
            level=ERROR,
            message='Thiếu ngày thu tiền',
            suggestion='Nhập ngày thu tiền trên phiếu'
        ))
    elif isinstance(detail.receipt_date, date) and \
         detail.receipt_date > date.today():
        issues.append(_issue(
            field='receipt_date',
            level=ERROR,
            message='Ngày thu tiền là ngày trong tương lai',
            suggestion='Kiểm tra lại ngày trên phiếu gốc'
        ))

    if not detail.payer_name or not detail.payer_name.strip():
        issues.append(_issue(
            field='payer_name',
            level=ERROR,
            message='Thiếu tên người nộp tiền',
            suggestion='Nhập họ tên người nộp tiền'
        ))

    if not detail.reason or len(detail.reason.strip()) < 3:
        issues.append(_issue(
            field='reason',
            level=ERROR,
            message='Thiếu lý do thu tiền',
            suggestion='Nhập nội dung/lý do thu tiền '
                       '(vd: Thu tiền hàng tháng 5/2026)'
        ))

    total = _to_decimal(detail.total_amount)
    if not total:
        issues.append(_issue(
            field='total_amount',
            level=ERROR,
            message='Thiếu số tiền thu',
            suggestion='Nhập số tiền thu trên phiếu'
        ))
    elif total <= 0:
        issues.append(_issue(
            field='total_amount',
            level=ERROR,
            message=f'Số tiền ({total:,.0f}đ) không hợp lệ',
            suggestion='Số tiền thu phải lớn hơn 0'
        ))

    if not detail.cashier or not detail.cashier.strip():
        issues.append(_issue(
            field='cashier',
            level=WARNING,
            message='Thiếu tên thu ngân/người lập phiếu',
            suggestion='Nhập tên người lập phiếu thu'
        ))

    # ── Số phiếu ──
    if not detail.invoice_code or not detail.invoice_code.strip():
        issues.append(_issue(
            field='invoice_code',
            level=INFO,
            message='Thiếu số phiếu thu',
            suggestion='Nhập số phiếu thu nếu có'
        ))

    return issues

# CHECK PHIẾU CHI
def check_payment(detail):
    issues = []
    if not detail:
        issues.append(_issue(
            field='detail',
            level=ERROR,
            message='Chưa có thông tin phiếu chi',
            suggestion='Nhập đầy đủ thông tin phiếu chi'
        ))
        return issues

    if not detail.payment_date:
        issues.append(_issue(
            field='payment_date',
            level=ERROR,
            message='Thiếu ngày chi tiền',
            suggestion='Nhập ngày chi tiền trên phiếu'
        ))
    elif isinstance(detail.payment_date, date) and \
         detail.payment_date > date.today():
        issues.append(_issue(
            field='payment_date',
            level=ERROR,
            message='Ngày chi tiền là ngày trong tương lai',
            suggestion='Kiểm tra lại ngày trên phiếu gốc'
        ))

    if not detail.payee_name or not detail.payee_name.strip():
        issues.append(_issue(
            field='payee_name',
            level=ERROR,
            message='Thiếu tên người nhận tiền',
            suggestion='Nhập họ tên người nhận tiền'
        ))

    # ── Lý do chi — BẮT BUỘC với phiếu chi ──
    if not detail.reason or len(detail.reason.strip()) < 3:
        issues.append(_issue(
            field='reason',
            level=ERROR,
            message='Thiếu lý do chi tiền — bắt buộc '
                    'để kiểm soát chi phí',
            suggestion='Nhập nội dung chi tiền '
                       '(vd: Chi mua văn phòng phẩm tháng 5)'
        ))

    total = _to_decimal(detail.total_amount)
    if not total:
        issues.append(_issue(
            field='total_amount',
            level=ERROR,
            message='Thiếu số tiền chi',
            suggestion='Nhập số tiền chi trên phiếu'
        ))
    elif total <= 0:
        issues.append(_issue(
            field='total_amount',
            level=ERROR,
            message=f'Số tiền ({total:,.0f}đ) không hợp lệ',
            suggestion='Số tiền chi phải lớn hơn 0'
        ))

    if not detail.cashier or not detail.cashier.strip():
        issues.append(_issue(
            field='cashier',
            level=WARNING,
            message='Thiếu tên thủ quỹ/người lập phiếu',
            suggestion='Nhập tên người lập phiếu chi'
        ))

    if not detail.payee_address or not detail.payee_address.strip():
        issues.append(_issue(
            field='payee_address',
            level=INFO,
            message='Thiếu địa chỉ người nhận',
            suggestion='Nhập địa chỉ người nhận nếu có'
        ))

    return issues

# CHECK PHIẾU NHẬP KHO
def check_warehouse(detail):
    issues = []
    if not detail:
        issues.append(_issue(
            field='detail',
            level=ERROR,
            message='Chưa có thông tin phiếu nhập kho',
            suggestion='Nhập đầy đủ thông tin phiếu nhập kho'
        ))
        return issues

    if not detail.warehouse_date:
        issues.append(_issue(
            field='warehouse_date',
            level=ERROR,
            message='Thiếu ngày nhập kho',
            suggestion='Nhập ngày nhập kho trên phiếu'
        ))
    elif isinstance(detail.warehouse_date, date) and \
         detail.warehouse_date > date.today():
        issues.append(_issue(
            field='warehouse_date',
            level=ERROR,
            message='Ngày nhập kho là ngày trong tương lai',
            suggestion='Kiểm tra lại ngày trên phiếu gốc'
        ))

    if not detail.supplier_name or not detail.supplier_name.strip():
        issues.append(_issue(
            field='supplier_name',
            level=ERROR,
            message='Thiếu tên nhà cung cấp',
            suggestion='Nhập tên nhà cung cấp/người giao hàng'
        ))

    if not detail.warehouse_name or not detail.warehouse_name.strip():
        issues.append(_issue(
            field='warehouse_name',
            level=WARNING,
            message='Thiếu tên kho nhập',
            suggestion='Nhập tên kho nhập hàng'
        ))

    items = list(detail.items.all()) if hasattr(detail, 'items') else []

    if not items:
        issues.append(_issue(
            field='items',
            level=ERROR,
            message='Chưa có danh sách hàng hóa nhập kho',
            suggestion='Nhập ít nhất 1 mặt hàng'
        ))
    else:
        issues += _check_warehouse_items(items)

        total = _to_decimal(detail.total_amount)
        if total and items:
            issues += _check_items_total(items, total, 'total_amount')

        total_qty = _to_decimal(detail.total_quantity)
        if total_qty and items:
            sum_qty = sum(
                _to_decimal(i.quantity) or Decimal(0)
                for i in items
            )
            diff = abs(sum_qty - total_qty)
            if diff > Decimal('0.01'):
                issues.append(_issue(
                    field='total_quantity',
                    level=WARNING,
                    message=f'Tổng số lượng ({total_qty:,.2f}) '
                            f'không khớp với tổng các mặt hàng '
                            f'({sum_qty:,.2f})',
                    suggestion='Kiểm tra lại số lượng từng mặt hàng'
                ))

    if not detail.warehouse_keeper or \
       not detail.warehouse_keeper.strip():
        issues.append(_issue(
            field='warehouse_keeper',
            level=WARNING,
            message='Thiếu tên thủ kho',
            suggestion='Nhập tên thủ kho xác nhận nhập hàng'
        ))

    return issues


# HELPER: Kiểm tra items
def _check_items_detail(items):
    issues = []
    for i, item in enumerate(items):
        prefix = f'Mặt hàng {i+1}'
        name   = getattr(item, 'item_name', '') or ''

        if not name.strip():
            issues.append(_issue(
                field=f'items[{i}].item_name',
                level=ERROR,
                message=f'{prefix}: Thiếu tên hàng hóa/dịch vụ',
                suggestion='Nhập tên hàng hóa hoặc dịch vụ'
            ))

        unit_price  = _to_decimal(getattr(item, 'unit_price', None))
        total_price = _to_decimal(getattr(item, 'total_price', None))

        if unit_price and total_price:
            quantity = _to_decimal(getattr(item, 'quantity', None))
            if quantity:
                expected = unit_price * quantity
                diff     = abs(expected - total_price)
                if diff > Decimal('100'):
                    issues.append(_issue(
                        field=f'items[{i}].total_price',
                        level=WARNING,
                        message=f'{prefix} ("{name}"): '
                                f'Thành tiền ({total_price:,.0f}đ) '
                                f'≠ đơn giá × số lượng '
                                f'({expected:,.0f}đ)',
                        suggestion='Kiểm tra lại đơn giá, '
                                   'số lượng và thành tiền'
                    ))

    return issues


def _check_warehouse_items(items):
    issues = []
    for i, item in enumerate(items):
        prefix = f'Hàng {i+1}'
        name   = getattr(item, 'item_name', '') or ''

        if not name.strip():
            issues.append(_issue(
                field=f'items[{i}].item_name',
                level=ERROR,
                message=f'{prefix}: Thiếu tên hàng hóa',
                suggestion='Nhập tên hàng hóa nhập kho'
            ))

        qty = _to_decimal(getattr(item, 'quantity', None))
        if qty is not None and qty <= 0:
            issues.append(_issue(
                field=f'items[{i}].quantity',
                level=ERROR,
                message=f'{prefix} ("{name}"): '
                        f'Số lượng ({qty}) không hợp lệ',
                suggestion='Số lượng phải lớn hơn 0'
            ))

        unit_price  = _to_decimal(getattr(item, 'unit_price', None))
        total_price = _to_decimal(getattr(item, 'total_price', None))

        if unit_price and qty and total_price:
            expected = unit_price * qty
            diff     = abs(expected - total_price)
            if diff > Decimal('100'):
                issues.append(_issue(
                    field=f'items[{i}].total_price',
                    level=WARNING,
                    message=f'{prefix} ("{name}"): '
                            f'Thành tiền ({total_price:,.0f}đ) '
                            f'≠ đơn giá × SL '
                            f'({expected:,.0f}đ)',
                    suggestion='Kiểm tra lại đơn giá × số lượng'
                ))

    return issues


def _check_items_total(items, total, field_name):
    issues  = []
    sum_total = sum(
        _to_decimal(getattr(i, 'total_price', None)) or Decimal(0)
        for i in items
    )

    if sum_total > 0 and total:
        diff = abs(sum_total - total)
        if diff > Decimal('1000'):
            issues.append(_issue(
                field=field_name,
                level=WARNING,
                message=f'Tổng tiền ({total:,.0f}đ) không khớp '
                        f'với tổng thành tiền các mặt hàng '
                        f'({sum_total:,.0f}đ)',
                suggestion='Kiểm tra lại thành tiền từng mặt hàng '
                           'và tổng tiền'
            ))
    return issues

#Chạy Quality Check
def run_quality_check(invoice_id, user):
    invoice = InvoiceNew.objects.select_related(
        'company', 'vat_detail', 'receipt_detail',
        'payment_detail', 'warehouse_detail',
    ).prefetch_related(
        'vat_detail__items',
        'warehouse_detail__items',
    ).get(id=invoice_id, uploaded_by=user)

    ocr_issues = check_ocr_status(invoice)
    if any(i['level'] == ERROR and i['field'] == 'ocr_status' for i in ocr_issues):
        result = {
            'invoice_id': invoice_id,
            'doc_type': invoice.document_type,
            'status': 'invalid',
            'status_label': 'OCR thất bại — Cần xử lý lại',
            'can_save': False,
            'issues': ocr_issues,
            'summary': {
                'total': len(ocr_issues),
                'errors': len([i for i in ocr_issues if i['level'] == ERROR]),
                'warnings': 0,
                'infos': 0,
            }
        }
        return sanitize_for_json(result)
    
    empty_issues = check_empty_detail(invoice)
    if any(i['field'] == 'detail' and i['level'] == ERROR for i in empty_issues):
        all_issues = ocr_issues + empty_issues
        result = {
            'invoice_id': invoice_id,
            'doc_type': invoice.document_type,
            'status': 'invalid',
            'status_label': 'Không có dữ liệu — Cần nhập liệu',
            'can_save': False,
            'issues': all_issues,
            'summary': {
                'total': len(all_issues),
                'errors': len([i for i in all_issues if i['level'] == ERROR]),
                'warnings': len([i for i in all_issues if i['level'] == WARNING]),
                'infos': len([i for i in all_issues if i['level'] == INFO]),
            }
        }
        return sanitize_for_json(result)

    all_issues = ocr_issues + empty_issues
    all_issues += check_common(invoice)

    # Check theo từng loại
    detail_map = {
        'invoice': ('vat_detail', check_invoice),
        'receipt': ('receipt_detail', check_receipt),
        'payment': ('payment_detail', check_payment),
        'warehouse': ('warehouse_detail', check_warehouse),
    }

    attr, checker = detail_map.get(
        invoice.document_type, (None, None)
    )
    if attr and checker:
        detail = getattr(invoice, attr, None)
        try:
            detail_obj = detail
        except Exception:
            detail_obj = None
        all_issues += checker(detail_obj)

    errors = [i for i in all_issues if i['level'] == ERROR]
    warnings = [i for i in all_issues if i['level'] == WARNING]
    infos = [i for i in all_issues if i['level'] == INFO]

    if errors:
        status = 'invalid'
        status_label = 'Không hợp lệ — Cần sửa trước khi lưu'
        can_save = False
    elif warnings:
        status = 'warning'
        status_label = 'Cần xem lại — Có thể lưu nhưng nên kiểm tra'
        can_save = True
    else:
        status = 'valid'
        status_label = 'Hợp lệ — Dữ liệu đầy đủ và chính xác'
        can_save = True

    result = {
        'invoice_id': invoice_id,
        'doc_type': invoice.document_type,
        'status': status,
        'status_label': status_label,
        'can_save': can_save,
        'issues': all_issues,
        'summary': {
            'total': len(all_issues),
            'errors': len(errors),
            'warnings': len(warnings),
            'infos': len(infos),
        }
    }
    return sanitize_for_json(result)