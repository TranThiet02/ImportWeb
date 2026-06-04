import os
import json
import base64
import re
from django.conf import settings
from .utils import sanitize_for_json

def _file_to_base64(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.pdf':
        from pdf2image import convert_from_path
        import numpy as np
        import cv2
        import io
        from PIL import Image

        pages = convert_from_path(file_path, dpi=200)
        if not pages:
            raise Exception("PDF không có trang nào")

        img_byte = io.BytesIO()
        pages[0].save(img_byte, format='PNG')
        img_bytes = img_byte.getvalue()
        return base64.b64encode(img_bytes).decode('utf-8'), 'image/png'

    else:
        with open(file_path, 'rb') as f:
            img_bytes = f.read()
        mime_map = {
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png':  'image/png',
        }
        mime = mime_map.get(ext, 'image/jpeg')
        return base64.b64encode(img_bytes).decode('utf-8'), mime


def _extract_from_image(file_path, doc_type):
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-3.5-flash')

    img_base64, mime_type = _file_to_base64(file_path)

    doc_labels = {
        'invoice':   'hóa đơn bán lẻ/bill',
        'receipt':   'phiếu thu tiền',
        'payment':   'phiếu chi tiền',
        'warehouse': 'phiếu nhập kho',
    }
    doc_label = doc_labels.get(doc_type, 'chứng từ')

    prompt = f"""Đọc {doc_label} trong ảnh và trả về JSON.
CHỈ trả về JSON, không giải thích.

{{
    "doc_type_detected": "loại chứng từ bạn nhận dạng được",
    "seller_name": "tên cửa hàng/công ty",
    "invoice_date": "ngày (YYYY-MM-DD hoặc text gốc)",
    "invoice_code": "số hóa đơn/số phiếu",
    "total_amount": số nguyên hoặc null,
    "subtotal": số nguyên hoặc null,
    "tax_amount": số nguyên hoặc null,
    "total_discount": số nguyên hoặc null,
    "received_amount": số nguyên hoặc null,
    "change_amount": số nguyên hoặc null,
    "cashier": "tên thu ngân",
    "payment_method": "phương thức thanh toán",
    "payer_name": "tên người nộp (phiếu thu)",
    "payee_name": "tên người nhận (phiếu chi)",
    "reason": "lý do thu/chi",
    "supplier_name": "nhà cung cấp (phiếu nhập kho)",
    "warehouse_name": "tên kho",
    "warehouse_keeper": "thủ kho",
    "items": [
        {{
            "item_name": "tên hàng",
            "unit": "đơn vị",
            "quantity": số hoặc null,
            "unit_price": số nguyên hoặc null,
            "total_price": số nguyên hoặc null
        }}
    ],
    "confidence_note": "ghi chú về độ rõ nét của ảnh"
}}

Lưu ý:
- Số tiền: số nguyên không dấu phẩy
- Không đọc được: null
- Chỉ JSON thuần"""

    response = model.generate_content([
        {'mime_type': mime_type, 'data': img_base64},
        prompt
    ])

    raw = response.text.strip()
    raw = raw.replace('```json', '').replace('```', '').strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise Exception(f"Gemini trả về không phải JSON: {raw[:200]}")


# ─────────────────────────────────────────
# So sánh 2 giá trị
# ─────────────────────────────────────────
def _compare_text(field, entered, from_image, label):
    """So sánh text — không phân biệt hoa thường, bỏ khoảng trắng thừa"""
    if from_image is None:
        return {
            'field':       field,
            'label':       label,
            'status':      'unverified',
            'entered':     entered,
            'from_image':  None,
            'message':     f'Không đọc được "{label}" từ ảnh',
        }

    if not entered and not from_image:
        return None 

    if not entered:
        return {
            'field':      field,
            'label':      label,
            'status':     'missing_in_form',
            'entered':    '',
            'from_image': from_image,
            'message':    f'Ảnh có "{label}": "{from_image}" '
                          f'nhưng chưa nhập vào form',
        }

    e = str(entered).lower().strip()
    i = str(from_image).lower().strip()

    if e == i:
        return {
            'field':      field,
            'label':      label,
            'status':     'match',
            'entered':    entered,
            'from_image': from_image,
            'message':    f'✅ Khớp',
        }

    # Kiểm tra xem có chứa nhau không
    if e in i or i in e:
        return {
            'field':      field,
            'label':      label,
            'status':     'partial_match',
            'entered':    entered,
            'from_image': from_image,
            'message':    f'⚠️ Gần khớp — nhập: "{entered}", '
                          f'ảnh: "{from_image}"',
        }

    return {
        'field':      field,
        'label':      label,
        'status':     'mismatch',
        'entered':    entered,
        'from_image': from_image,
        'message':    f'❌ Không khớp — nhập: "{entered}", '
                      f'ảnh: "{from_image}"',
    }


def _compare_amount(field, entered, from_image, label):
    """So sánh số tiền — cho phép chênh lệch 1000đ"""
    if from_image is None:
        return {
            'field':      field,
            'label':      label,
            'status':     'unverified',
            'entered':    entered,
            'from_image': None,
            'message':    f'Không đọc được "{label}" từ ảnh',
        }

    if not entered and not from_image:
        return None

    if not entered:
        return {
            'field':      field,
            'label':      label,
            'status':     'missing_in_form',
            'entered':    None,
            'from_image': from_image,
            'message':    f'Ảnh có "{label}": '
                          f'{float(from_image):,.0f}đ '
                          f'nhưng chưa nhập vào form',
        }

    try:
        e = float(str(entered))
        i = float(str(from_image))
    except (ValueError, TypeError):
        return None

    diff = abs(e - i)
    diff_pct = diff / i * 100 if i > 0 else 0

    if diff <= 1000:
        return {
            'field':      field,
            'label':      label,
            'status':     'match',
            'entered':    entered,
            'from_image': from_image,
            'message':    f'✅ Khớp: {e:,.0f}đ',
        }
    elif diff_pct <= 5:
        return {
            'field':      field,
            'label':      label,
            'status':     'partial_match',
            'entered':    entered,
            'from_image': from_image,
            'message':    f'⚠️ Chênh lệch nhỏ — '
                          f'nhập: {e:,.0f}đ, '
                          f'ảnh: {i:,.0f}đ '
                          f'(chênh {diff:,.0f}đ)',
        }

    return {
        'field':      field,
        'label':      label,
        'status':     'mismatch',
        'entered':    entered,
        'from_image': from_image,
        'message':    f'❌ Sai số tiền — '
                      f'nhập: {e:,.0f}đ, '
                      f'ảnh: {i:,.0f}đ '
                      f'(chênh {diff:,.0f}đ)',
    }


def _compare_items(entered_items, image_items):
    """So sánh danh sách mặt hàng"""
    results = []

    if not image_items:
        return [{
            'status':  'unverified',
            'message': 'Không đọc được danh sách mặt hàng từ ảnh',
        }]

    if not entered_items:
        return [{
            'status':  'missing_in_form',
            'message': f'Ảnh có {len(image_items)} mặt hàng '
                       f'nhưng chưa nhập vào form',
        }]

    # So sánh số lượng items
    if len(entered_items) != len(image_items):
        results.append({
            'status':  'mismatch',
            'message': f'❌ Số mặt hàng không khớp — '
                       f'nhập: {len(entered_items)}, '
                       f'ảnh: {len(image_items)}',
        })

    # So sánh từng item theo thứ tự
    for i, (e_item, i_item) in enumerate(
        zip(entered_items, image_items)
    ):
        item_issues = []

        # Tên hàng
        e_name = getattr(e_item, 'item_name', '') or ''
        i_name = i_item.get('item_name', '') or ''
        if e_name and i_name:
            if e_name.lower().strip() != i_name.lower().strip():
                item_issues.append(
                    f'tên: nhập "{e_name}", ảnh "{i_name}"'
                )

        # Số lượng
        e_qty = getattr(e_item, 'quantity', None)
        i_qty = i_item.get('quantity')
        if e_qty and i_qty:
            if abs(float(str(e_qty)) - float(str(i_qty))) > 0.01:
                item_issues.append(
                    f'SL: nhập {e_qty}, ảnh {i_qty}'
                )

        # Đơn giá
        e_price = getattr(e_item, 'unit_price', None)
        i_price = i_item.get('unit_price')
        if e_price and i_price:
            diff = abs(float(str(e_price)) - float(str(i_price)))
            if diff > 1000:
                item_issues.append(
                    f'đơn giá: nhập {float(str(e_price)):,.0f}đ, '
                    f'ảnh {float(str(i_price)):,.0f}đ'
                )

        if item_issues:
            results.append({
                'status':  'mismatch',
                'item_no': i + 1,
                'message': f'❌ Mặt hàng {i+1} không khớp: '
                           + ', '.join(item_issues),
            })
        else:
            results.append({
                'status':  'match',
                'item_no': i + 1,
                'message': f'✅ Mặt hàng {i+1} khớp',
            })

    return results


# ─────────────────────────────────────────
# MAIN: Chạy Image Verification
# ─────────────────────────────────────────
def run_image_verification(invoice_id, user):
    from .models import InvoiceNew

    invoice = InvoiceNew.objects.select_related(
        'company', 'vat_detail', 'receipt_detail',
        'payment_detail', 'warehouse_detail',
    ).prefetch_related(
        'vat_detail__items',
        'warehouse_detail__items',
    ).get(id=invoice_id, uploaded_by=user)

    if not invoice.file:
        raise Exception("Không có file ảnh để xác minh")

    # Gemini đọc ảnh gốc
    image_data = _extract_from_image(
        invoice.file.path,
        invoice.document_type
    )

    #Lấy dữ liệu đã nhập
    detail_map = {
        'invoice':   'vat_detail',
        'receipt':   'receipt_detail',
        'payment':   'payment_detail',
        'warehouse': 'warehouse_detail',
    }
    attr   = detail_map.get(invoice.document_type)
    detail = getattr(invoice, attr, None) if attr else None

    #So sánh từng field
    comparisons = []

    # Fields chung
    c = _compare_text(
        'company', invoice.company.name if invoice.company else '',
        image_data.get('seller_name'), 'Tên cửa hàng/công ty'
    )
    if c: comparisons.append(c)

    if detail:
        # So sánh theo từng loại
        if invoice.document_type == 'invoice':
            comparisons += _compare_invoice(detail, image_data)
        elif invoice.document_type == 'receipt':
            comparisons += _compare_receipt(detail, image_data)
        elif invoice.document_type == 'payment':
            comparisons += _compare_payment(detail, image_data)
        elif invoice.document_type == 'warehouse':
            comparisons += _compare_warehouse(detail, image_data)

    #Tổng hợp kết quả
    mismatches   = [c for c in comparisons if c['status'] == 'mismatch']
    partials     = [c for c in comparisons if c['status'] == 'partial_match']
    unverified   = [c for c in comparisons if c['status'] == 'unverified']
    missing      = [c for c in comparisons if c['status'] == 'missing_in_form']
    matches      = [c for c in comparisons if c['status'] == 'match']

    if mismatches or missing:
        overall = 'failed'
        overall_label = 'Dữ liệu không khớp với ảnh gốc'
    elif partials:
        overall = 'partial'
        overall_label = 'Một số trường gần khớp — cần kiểm tra lại'
    elif unverified:
        overall = 'unverified'
        overall_label = 'Một số trường không đọc được từ ảnh'
    else:
        overall = 'passed'
        overall_label = 'Dữ liệu khớp hoàn toàn với ảnh gốc'
    
    result = {
        'invoice_id': invoice_id,
        'doc_type': invoice.document_type,
        'overall': overall,
        'overall_label': overall_label,
        'comparisons': comparisons,
        'image_data': image_data,
        'summary': {
            'total': len(comparisons),
            'match': len(matches),
            'mismatch': len(mismatches),
            'partial': len(partials),
            'unverified': len(unverified),
            'missing': len(missing),
        },
        'confidence_note': image_data.get('confidence_note', ''),
    }

    return sanitize_for_json(result)


# ─────────────────────────────────────────
# Compare theo từng loại
# ─────────────────────────────────────────
def _compare_invoice(detail, image_data):
    results = []

    fields = [
        ('invoice_date',    'invoice_date',    'Ngày hóa đơn',      'text'),
        ('invoice_code',    'invoice_code',    'Số hóa đơn',        'text'),
        ('seller_name',     'seller_name',     'Tên cửa hàng',      'text'),
        ('payment_method',  'payment_method',  'Phương thức TT',    'text'),
        ('cashier',         'cashier',         'Thu ngân',          'text'),
        ('subtotal',        'subtotal',        'Tạm tính',          'amount'),
        ('total_discount',  'total_discount',  'Tổng giảm giá',     'amount'),
        ('tax_amount',      'tax_amount',      'Thuế',              'amount'),
        ('total_amount',    'total_amount',    'Tổng tiền',         'amount'),
        ('received_amount', 'received_amount', 'Tiền khách đưa',    'amount'),
        ('change_amount',   'change_amount',   'Tiền thừa',         'amount'),
    ]

    for model_field, img_field, label, field_type in fields:
        entered    = getattr(detail, model_field, None)
        from_image = image_data.get(img_field)

        if field_type == 'amount':
            c = _compare_amount(model_field, entered, from_image, label)
        else:
            c = _compare_text(model_field, str(entered) if entered else '', from_image, label)

        if c:
            results.append(c)

    # So sánh items
    items = list(detail.items.all()) if hasattr(detail, 'items') else []
    image_items = image_data.get('items', [])
    if items or image_items:
        item_results = _compare_items(items, image_items)
        results += item_results

    return results


def _compare_receipt(detail, image_data):
    results = []

    fields = [
        ('receipt_date',  'invoice_date', 'Ngày thu',        'text'),
        ('invoice_code',  'invoice_code', 'Số phiếu',        'text'),
        ('payer_name',    'payer_name',   'Tên người nộp',   'text'),
        ('reason',        'reason',       'Lý do thu',       'text'),
        ('payment_method','payment_method','Phương thức TT', 'text'),
        ('cashier',       'cashier',      'Thu ngân',        'text'),
        ('total_amount',  'total_amount', 'Số tiền thu',     'amount'),
    ]

    for model_field, img_field, label, field_type in fields:
        entered    = getattr(detail, model_field, None)
        from_image = image_data.get(img_field)

        if field_type == 'amount':
            c = _compare_amount(model_field, entered, from_image, label)
        else:
            c = _compare_text(
                model_field,
                str(entered) if entered else '',
                from_image, label
            )
        if c:
            results.append(c)

    return results


def _compare_payment(detail, image_data):
    results = []

    fields = [
        ('payment_date',  'invoice_date', 'Ngày chi',         'text'),
        ('invoice_code',  'invoice_code', 'Số phiếu',         'text'),
        ('payee_name',    'payee_name',   'Tên người nhận',   'text'),
        ('reason',        'reason',       'Lý do chi',        'text'),
        ('payment_method','payment_method','Phương thức TT',  'text'),
        ('cashier',       'cashier',      'Thủ quỹ',          'text'),
        ('total_amount',  'total_amount', 'Số tiền chi',      'amount'),
    ]

    for model_field, img_field, label, field_type in fields:
        entered    = getattr(detail, model_field, None)
        from_image = image_data.get(img_field)

        if field_type == 'amount':
            c = _compare_amount(model_field, entered, from_image, label)
        else:
            c = _compare_text(
                model_field,
                str(entered) if entered else '',
                from_image, label
            )
        if c:
            results.append(c)

    return results


def _compare_warehouse(detail, image_data):
    results = []

    fields = [
        ('warehouse_date',   'invoice_date',    'Ngày nhập',        'text'),
        ('invoice_code',     'invoice_code',    'Số phiếu',         'text'),
        ('supplier_name',    'supplier_name',   'Nhà cung cấp',     'text'),
        ('warehouse_name',   'warehouse_name',  'Tên kho',          'text'),
        ('delivery_person',  'cashier',         'Người giao hàng',  'text'),
        ('warehouse_keeper', 'warehouse_keeper','Thủ kho',          'text'),
        ('total_amount',     'total_amount',    'Tổng tiền',        'amount'),
        ('total_quantity',   'total_amount',    'Tổng số lượng',    'amount'),
    ]

    for model_field, img_field, label, field_type in fields:
        entered    = getattr(detail, model_field, None)
        from_image = image_data.get(img_field)

        if field_type == 'amount':
            c = _compare_amount(model_field, entered, from_image, label)
        else:
            c = _compare_text(
                model_field,
                str(entered) if entered else '',
                from_image, label
            )
        if c:
            results.append(c)

    # So sánh items kho
    items = list(detail.items.all()) if hasattr(detail, 'items') else []
    image_items = image_data.get('items', [])
    if items or image_items:
        results += _compare_items(items, image_items)

    return results