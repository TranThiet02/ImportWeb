from celery import shared_task
from invoiceupgrade.models import (InvoiceNew, Company, VATInvoiceDetail, VATInvoiceItem)
from .ocr_service import run_ocr_pipeline
from invoiceupgrade.image_verifier import run_image_verification
from invoiceupgrade.quality_checker import run_quality_check
from invoiceupgrade.utils import sanitize_for_json

# @shared_task(bind=True, max_retries=3)
# def run_ocr_task(self, invoice_id):
#     try: 
#         try:
#             invoice = InvoiceNew.objects.get(id=invoice_id)
#         except InvoiceNew.DoesNotExist:
#             return {'status': 'error', 'message': 'Invoice not found'}

#         if invoice.source != 'ai':
#             return {'status': 'error', 'message': 'Invalid source'}

#         if invoice.ocr_status not in ['pending', 'failed']:
#             return {'status': 'skip', 'message': 'Already processed'}

#         invoice.ocr_status = 'processing'
#         invoice.save()

#         result = run_ocr_pipeline(invoice.file.path)
#         invoice.ocr_result = result
#         invoice.ocr_status = 'done'
#         invoice.save()

#         return {'status': 'success', 'invoice_id': invoice_id}
#     except Exception as e:
#         try:
#             raise self.retry(exc=e, countdown=60)
#         except self.MaxRetriesExceededError:
#             invoice = InvoiceNew.objects.get(id=invoice_id)
#             invoice.ocr_status = 'failed'
#             invoice.save()
#             return {'status': 'failed', 'error': str(e)}
import logging
import time
logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def run_ocr_task(self, invoice_id):
    try:
        invoice = InvoiceNew.objects.get(id=invoice_id)
        invoice.ocr_status = 'processing'
        invoice.ocr_result = {'progress': 'Khởi động...', 'percent': 10}
        invoice.save()
        logger.info(f"AI OCR START - {invoice_id}")

        # Load model
        invoice.ocr_result = {'progress': 'Load mô hình YOLO...', 'percent': 20}
        invoice.save()

        # Chạy YOLO
        invoice.ocr_result = {'progress': 'YOLO detect các vùng...', 'percent': 30}
        invoice.save()

        start = time.time()
        result = run_ocr_pipeline(invoice.file.path)
        logger.info(f"YOLO xong trong {time.time()-start:.1f}s")

        detail_data = result.get('detail', {})
        confidence_score = result.get('confidence_score', 65)

        # Xử lý kết quả
        invoice.ocr_result = sanitize_for_json({
            'progress': 'Xử lý kết quả OCR...',
            'percent': 70,
        })
        invoice.save()

        # Fill
        invoice.ocr_result = sanitize_for_json({ 
            'progress': 'Điền thông tin vào form...',
            'percent': 80,
        })
        invoice.save()

        _fill_vat_detail(invoice, detail_data)

        # Confidence check
        invoice.ocr_result = sanitize_for_json({ 
            'progress': f'Confidence: {confidence_score}%...',
            'percent': 90,
            'confidence_score': confidence_score,
        })
        invoice.save()

        if confidence_score >= 80:
            logger.info(f"Auto save - confidence {confidence_score}%")
            invoice.ocr_status = 'done'
            invoice.ocr_result = sanitize_for_json({
                'source': 'ai',
                'confidence_score': confidence_score,
                'detail': detail_data,
                'auto_saved': True,
                'progress': f'Tự động lưu (confidence {confidence_score}%)',
                'percent': 100,
            })
            invoice.save()
            return {'status': 'success', 'auto_saved': True}

        else:
            logger.info(f"Need verify - confidence {confidence_score}%")

            invoice.ocr_result = sanitize_for_json({
                'progress': 'Xác minh với ảnh gốc...',
                'percent': 92,
                'confidence_score': confidence_score,
            })
            invoice.save()

            try:
                from invoiceupgrade.image_verifier import run_image_verification
                from invoiceupgrade.quality_checker import run_quality_check

                verify_result = run_image_verification(invoice_id, invoice.uploaded_by)
                qc_result = run_quality_check(invoice_id, invoice.uploaded_by)

                invoice.ocr_status = 'done'
                invoice.ocr_result = sanitize_for_json({ 
                    'source': 'ai',
                    'confidence_score': confidence_score,
                    'detail': detail_data,
                    'verify': verify_result,
                    'quality': qc_result,
                    'auto_saved': False,
                    'progress': f'Cần xem lại (confidence {confidence_score}%)',
                    'percent': 100,
                })
                invoice.save()

            except Exception as e:
                logger.warning(f"Verify/QC lỗi: {e}")
                invoice.ocr_status = 'done'
                invoice.ocr_result = sanitize_for_json({ 
                    'source': 'ai',
                    'confidence_score': confidence_score,
                    'detail': detail_data,
                    'auto_saved': False,
                    'progress': f'Cần xem lại (confidence {confidence_score}%)',
                    'percent': 100,
                })
                invoice.save()

            return {'status': 'success', 'auto_saved': False}

    except Exception as e:
        logger.error(f"AI OCR ERROR: {e}", exc_info=True)
        try:
            invoice = InvoiceNew.objects.get(id=invoice_id)
            invoice.ocr_status = 'failed'
            invoice.ocr_result = {
                'progress': f'Lỗi: {str(e)[:100]}',
                'percent':  0,
                'error': str(e),
            }
            invoice.save()
        except:
            pass
        raise self.retry(exc=e, countdown=60)

def _fill_vat_detail(invoice, detail):
    def clean(v):
        return None if v in [None, '', 'null'] else v

    obj, _ = VATInvoiceDetail.objects.get_or_create(invoice=invoice)

    fillable_fields = [
        'invoice_date', 'seller_name', 'seller_address',
        'payment_method', 'subtotal', 'total_discount',
        'tax_amount', 'total_amount', 'received_amount',
        'change_amount', 'cashier',
    ]

    for field in fillable_fields:
        val = clean(detail.get(field))
        if val is not None and hasattr(obj, field):
            setattr(obj, field, val)

    obj.save()

    items = detail.get('items', [])
    if items:
        VATInvoiceItem.objects.filter(vat_invoice=obj).delete()
        for item in items:
            VATInvoiceItem.objects.create(
                vat_invoice=obj,
                item_name = clean(item.get('item_name')) or '',
                unit = clean(item.get('unit')) or '',
                quantity = clean(item.get('quantity')),
                unit_price = clean(item.get('unit_price')),
                total_price = clean(item.get('total_price')),
                tax_rate = clean(item.get('tax_rate')),
            )
