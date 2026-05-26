# invoicegemini/tasks.py
from celery import shared_task
from invoiceupgrade.models import (
        InvoiceNew, Company,
        VATInvoiceDetail, VATInvoiceItem,
        ReceiptDetail, PaymentDetail,
        WarehouseDetail, WarehouseItem,
    ) 
from .gemini_service import run_gemini_pipeline

@shared_task(bind=True, max_retries=3)
def run_gemini_task(self, invoice_id):
    try:
        invoice = InvoiceNew.objects.get(id=invoice_id)
        invoice.ocr_status = 'processing'
        invoice.save()

        result = run_gemini_pipeline(invoice.file.path)

        invoice.ocr_result    = result
        invoice.ocr_status    = 'done'
        invoice.document_type = result.get('document_type', 'invoice')

        company_name = result.get('company_name', '').strip()
        if company_name:
            company, _ = Company.objects.get_or_create(name=company_name)
            invoice.company = company

        invoice.save()

        _fill_detail(invoice, result)

        return {'status': 'success', 'invoice_id': invoice_id}

    except Exception as e:
        try:
            raise self.retry(exc=e, countdown=30)
        except self.MaxRetriesExceededError:
            invoice = InvoiceNew.objects.get(id=invoice_id)
            invoice.ocr_status = 'failed'
            invoice.save()
            return {'status': 'failed', 'error': str(e)}


def _fill_detail(invoice, result):
    doc_type = result.get('document_type', 'invoice')
    detail = result.get('detail', {})

    def clean(v):
        return None if v in [None, '', 'null', 0] else v

    if doc_type == 'invoice':
        items = detail.pop('items', [])
        obj, _ = VATInvoiceDetail.objects.get_or_create(invoice=invoice)

        field_map = {
            'invoice_date': 'invoice_date',
            'seller_name': 'seller_name',
            'seller_address': 'seller_address',
            'payment_method': 'payment_method',
            'subtotal': 'subtotal',
            'total_discount': 'total_discount',
            'tax_amount': 'tax_amount',
            'total_amount': 'total_amount',
            'received_amount': 'received_amount',
            'change_amount': 'change_amount',
            'cashier': 'cashier',
        }
        for gemini_field, model_field in field_map.items():
            val = clean(detail.get(gemini_field))
            if val is not None and hasattr(obj, model_field):
                setattr(obj, model_field, val)
        obj.save()

        if items:
            VATInvoiceItem.objects.filter(vat_invoice=obj).delete()
            for item in items:
                VATInvoiceItem.objects.create(
                    vat_invoice=obj,
                    item_name = clean(item.get('item_name'))   or '',
                    unit = clean(item.get('unit'))        or '',
                    quantity = clean(item.get('quantity')),
                    unit_price = clean(item.get('unit_price')),
                    total_price = clean(item.get('total_price')),
                )

    elif doc_type == 'receipt':
        obj, _ = ReceiptDetail.objects.get_or_create(invoice=invoice)
        for field in [
            'invoice_code', 'receipt_date', 'payer_name',
            'payer_address', 'reason', 'payment_method',
            'total_amount', 'cashier', 'accountant'
        ]:
            val = clean(detail.get(field))
            if val is not None and hasattr(obj, field):
                setattr(obj, field, val)
        obj.save()

    elif doc_type == 'payment':
        obj, _ = PaymentDetail.objects.get_or_create(invoice=invoice)
        for field in [
            'invoice_code', 'payment_date', 'payee_name',
            'payee_address', 'reason', 'payment_method',
            'total_amount', 'cashier', 'accountant'
        ]:
            val = clean(detail.get(field))
            if val is not None and hasattr(obj, field):
                setattr(obj, field, val)
        obj.save()

    elif doc_type == 'warehouse':
        items = detail.pop('items', [])
        obj, _ = WarehouseDetail.objects.get_or_create(invoice=invoice)
        for field in [
            'invoice_code', 'warehouse_date', 'warehouse_name',
            'supplier_name', 'supplier_address', 'delivery_person',
            'total_quantity', 'total_amount',
            'warehouse_keeper', 'accountant'
        ]:
            val = clean(detail.get(field))
            if val is not None and hasattr(obj, field):
                setattr(obj, field, val)
        obj.save()

        if items:
            WarehouseItem.objects.filter(warehouse_detail=obj).delete()
            for item in items:
                WarehouseItem.objects.create(
                    warehouse_detail=obj,
                    item_name = clean(item.get('item_name'))   or '',
                    unit = clean(item.get('unit'))        or '',
                    quantity = clean(item.get('quantity')),
                    unit_price = clean(item.get('unit_price')),
                    total_price = clean(item.get('total_price')),
                )