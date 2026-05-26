from django.contrib import admin
from .models import (
    InvoiceNew, VATInvoiceDetail, ReceiptDetail,
    PaymentDetail, WarehouseDetail, WarehouseItem, VATInvoiceItem
)

class WarehouseItemInline(admin.TabularInline):
    model = WarehouseItem
    extra = 1

class VATInvoiceItemInline(admin.TabularInline):
    model = VATInvoiceItem
    extra = 1

@admin.register(InvoiceNew)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['id', 'document_type', 'uploaded_by', 'ocr_status', 'created_at']
    list_filter  = ['document_type', 'ocr_status']

@admin.register(VATInvoiceDetail)
class VATAdmin(admin.ModelAdmin):
    list_display = ['seller_name', 'invoice_date', 'total_amount']
    inlines = [VATInvoiceItemInline]

@admin.register(ReceiptDetail)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ['invoice_code', 'payer_name', 'total_amount']

@admin.register(PaymentDetail)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['invoice_code', 'payee_name', 'total_amount']

@admin.register(WarehouseDetail)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ['invoice_code', 'warehouse_name', 'supplier_name', 'total_amount']
    inlines = [WarehouseItemInline]