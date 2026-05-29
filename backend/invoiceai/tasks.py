from celery import shared_task
from invoiceupgrade.models import (InvoiceNew, Company, VATInvoiceDetail, VATInvoiceItem)
from .ocr_service import run_ocr_pipeline
import json


@shared_task(bind=True, max_retries=3)
def run_ocr_task(self, invoice_id):
    try: 
        try:
            invoice = InvoiceNew.objects.get(id=invoice_id)
        except InvoiceNew.DoesNotExist:
            return {'status': 'error', 'message': 'Invoice not found'}

        if invoice.source != 'ai':
            return {'status': 'error', 'message': 'Invalid source'}

        if invoice.ocr_status not in ['pending', 'failed']:
            return {'status': 'skip', 'message': 'Already processed'}

        invoice.ocr_status = 'processing'
        invoice.save()

        result = run_ocr_pipeline(invoice.file.path)
        invoice.ocr_result = result
        invoice.ocr_status = 'done'
        invoice.save()

        return {'status': 'success', 'invoice_id': invoice_id}
    except Exception as e:
        try:
            raise self.retry(exc=e, countdown=60)
        except self.MaxRetriesExceededError:
            invoice = InvoiceNew.objects.get(id=invoice_id)
            invoice.ocr_status = 'failed'
            invoice.save()
            return {'status': 'failed', 'error': str(e)}


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
