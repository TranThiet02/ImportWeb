import logging
from celery import shared_task
from invoiceupgrade.models import InvoiceNew, Company, WarehouseDetail, WarehouseItem, PaymentDetail, ReceiptDetail, VATInvoiceDetail, VATInvoiceItem
from invoiceupgrade.image_verifier import run_image_verification
from invoiceupgrade.quality_checker import run_quality_check
from .gemini_service import (extract_from_image_gemini, _normalize_detail)
from invoiceupgrade.utils import sanitize_for_json


logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def run_gemini_task(self, invoice_id):
    try:
        invoice = InvoiceNew.objects.get(id=invoice_id)
        invoice.ocr_status = 'processing'
        invoice.ocr_result = {'progress': 'Gemini đang đọc...', 'percent': 10}
        invoice.save()
        logger.info(f"Gemini task START - invoice_id: {invoice_id}")

        # Gọi Gemini
        result = extract_from_image_gemini(
            invoice.file.path,
            invoice.document_type
        )

        confidence_score = result['confidence_score']
        quality_note = result.get('quality_note', '')
        raw_detail = result.get('detail', {})

        logger.info(f"Gemini confidence: {confidence_score}%")
        logger.info(f"Raw detail: {raw_detail}")

        # Normalize detail
        detail_data = _normalize_detail(raw_detail, invoice.document_type)
        logger.info(f"Normalized detail: {detail_data}")

        # Kiểm tra detail có dữ liệu không
        has_data = any(
            v for v in detail_data.values()
            if v is not None and v != [] and v != {}
        )

        if not has_data:
            logger.warning("Detail rỗng sau normalize giảm confidence")
            confidence_score = min(confidence_score, 20)

        # Update progress
        invoice.ocr_result = sanitize_for_json({ 
            'progress': 'Đang fill dữ liệu...',
            'percent': 70,
            'confidence_score': confidence_score,
        })
        invoice.save()

        _fill_invoice_detail(invoice, detail_data)
        logger.info(f"Fill xong")

        if confidence_score >= 80 and has_data:
            # Auto save
            invoice.ocr_status = 'done'
            invoice.ocr_result = {
                'source':           'gemini',
                'confidence_score': confidence_score,
                'quality_note': quality_note,
                'detail': detail_data,
                'auto_saved': True,
                'progress': f'Tự động lưu (confidence {confidence_score}%)',
                'percent': 100,
            }
            invoice.save()
            logger.info(f"Auto saved - confidence {confidence_score}%")
            return {'status': 'success', 'auto_saved': True, 'confidence': confidence_score}

        else:
            # Cần verify
            invoice.ocr_result = {
                'progress': 'Đang xác minh...', 'percent': 85,
                'confidence_score': confidence_score,
            }
            invoice.save()

            # Auto verify + QC
            try:
                verify_result = run_image_verification(invoice_id, invoice.uploaded_by)
                qc_result = run_quality_check(invoice_id, invoice.uploaded_by)

                invoice.ocr_status = 'done'
                invoice.ocr_result = {
                    'source': 'gemini',
                    'confidence_score': confidence_score,
                    'quality_note': quality_note,
                    'detail': detail_data,
                    'verify': verify_result,
                    'quality': qc_result,
                    'auto_saved': False,
                    'progress': f'Cần xem lại (confidence {confidence_score}%)',
                    'percent': 100,
                }
                invoice.save()
            except Exception as e:
                logger.warning(f"Verify/QC lỗi: {e}")
                invoice.ocr_status = 'done'
                invoice.ocr_result = {
                    'source': 'gemini',
                    'confidence_score': confidence_score,
                    'detail': detail_data,
                    'auto_saved': False,
                    'progress': f'Cần xem lại (confidence {confidence_score}%)',
                    'percent': 100,
                }
                invoice.save()

            return {'status': 'success', 'auto_saved': False, 'confidence': confidence_score}

    except Exception as e:
        logger.error(f"Gemini task ERROR: {e}", exc_info=True)
        try:
            invoice = InvoiceNew.objects.get(id=invoice_id)
            invoice.ocr_status = 'failed'
            invoice.ocr_result = {
                'progress': f'Lỗi: {str(e)[:100]}',
                'percent':  0,
                'error':    str(e),
            }
            invoice.save()
        except:
            pass
        raise self.retry(exc=e, countdown=60)


def _fill_invoice_detail(invoice, detail_data):
    doc_type = invoice.document_type
    logger.info(f"Fill detail for doc_type: {doc_type}")

    seller_name = (
        detail_data.get('seller_name') or
        detail_data.get('payer_name') or
        detail_data.get('payee_name') or
        detail_data.get('supplier_name') or
        ''
    )
    if seller_name and seller_name.strip():
        company, _ = Company.objects.get_or_create(
            name=seller_name.strip(),
            defaults={'name': seller_name.strip()}
        )
        invoice.company = company
        invoice.save()
        logger.info(f"Company: {company.name}")

    if doc_type == 'invoice':
        _fill_vat_detail(invoice, detail_data)
    elif doc_type == 'receipt':
        _fill_receipt_detail(invoice, detail_data)
    elif doc_type == 'payment':
        _fill_payment_detail(invoice, detail_data)
    elif doc_type == 'warehouse':
        _fill_warehouse_detail(invoice, detail_data)


def _fill_vat_detail(invoice, d):
    logger.info(f"Fill VATInvoiceDetail: {d}")

    # Tạo hoặc update
    detail, created = VATInvoiceDetail.objects.update_or_create(
        invoice=invoice,
        defaults={
            'seller_name': d.get('seller_name') or '',
            'invoice_date': d.get('invoice_date'),
            'invoice_code': d.get('invoice_code') or '',
            'payment_method': d.get('payment_method') or '',
            'cashier': d.get('cashier') or '',
            'subtotal': d.get('subtotal'),
            'total_discount': d.get('total_discount'),
            'tax_amount': d.get('tax_amount'),
            'total_amount': d.get('total_amount'),
            'received_amount': d.get('received_amount'),
            'change_amount': d.get('change_amount'),
        }
    )
    logger.info(f"VATInvoiceDetail {'created' if created else 'updated'}: total={d.get('total_amount')}")

    # Fill items
    items = d.get('items', [])
    if items:
        detail.items.all().delete()
        for item in items:
            if not item.get('item_name'):
                continue
            VATInvoiceItem.objects.create(
                vat_invoice=detail,
                item_name=item.get('item_name') or '',
                unit=item.get('unit') or '',
                quantity=item.get('quantity'),
                unit_price=item.get('unit_price'),
                total_price=item.get('total_price'),
            )
        logger.info(f"Filled {len(items)} items")


def _fill_receipt_detail(invoice, d):
    detail, created = ReceiptDetail.objects.update_or_create(
        invoice=invoice,
        defaults={
            'receipt_date': d.get('receipt_date'),
            'invoice_code': d.get('invoice_code') or '',
            'payer_name': d.get('payer_name') or '',
            'payer_address': d.get('payer_address') or '',
            'reason': d.get('reason') or '',
            'payment_method': d.get('payment_method') or '',
            'total_amount': d.get('total_amount'),
            'cashier': d.get('cashier') or '',
            'accountant': d.get('accountant') or '',
        }
    )
    logger.info(f"ReceiptDetail {'created' if created else 'updated'}")


def _fill_payment_detail(invoice, d):
    detail, created = PaymentDetail.objects.update_or_create(
        invoice=invoice,
        defaults={
            'payment_date': d.get('payment_date'),
            'invoice_code': d.get('invoice_code') or '',
            'payee_name': d.get('payee_name') or '',
            'payee_address': d.get('payee_address') or '',
            'reason': d.get('reason') or '',
            'payment_method': d.get('payment_method') or '',
            'total_amount': d.get('total_amount'),
            'cashier': d.get('cashier') or '',
            'accountant': d.get('accountant') or '',
        }
    )
    logger.info(f"PaymentDetail {'created' if created else 'updated'}")


def _fill_warehouse_detail(invoice, d):
    detail, created = WarehouseDetail.objects.update_or_create(
        invoice=invoice,
        defaults={
            'warehouse_date': d.get('warehouse_date'),
            'invoice_code': d.get('invoice_code') or '',
            'warehouse_name': d.get('warehouse_name') or '',
            'supplier_name': d.get('supplier_name') or '',
            'supplier_address': d.get('supplier_address') or '',
            'delivery_person': d.get('delivery_person') or '',
            'total_quantity': d.get('total_quantity'),
            'total_amount': d.get('total_amount'),
            'warehouse_keeper': d.get('warehouse_keeper') or '',
            'accountant': d.get('accountant') or '',
        }
    )

    items = d.get('items', [])
    if items:
        detail.items.all().delete()
        for item in items:
            if not item.get('item_name'):
                continue
            WarehouseItem.objects.create(
                warehouse_detail=detail,
                item_name=item.get('item_name') or '',
                unit=item.get('unit') or '',
                quantity=item.get('quantity'),
                unit_price=item.get('unit_price'),
                total_price=item.get('total_price'),
            )
    logger.info(f"WarehouseDetail {'created' if created else 'updated'}")