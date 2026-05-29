from django.db import models
from accounts.models import Users
from django.core.exceptions import ValidationError
import os, magic, uuid

def validate_file_type(value):
    allowed = ['.pdf', '.jpg', '.jpeg', '.png']
    ext = os.path.splitext(value.name)[1].lower()
    if ext not in allowed:
        raise ValidationError(f'Chỉ chấp nhận: {", ".join(allowed)}')
    
    max_size = 10 * 1024 * 1024
    if value.size > max_size:
        raise ValidationError('File không được vượt quá 10MB')
    file_mime = magic.from_buffer(value.read(2048), mime=True)
    value.seek(0)

    allowed_mimes = ['image/jpeg', 'image/png', 'application/pdf']
    if file_mime not in allowed_mimes:
        raise ValidationError(f'File không hợp lệ. Loại file thực: {file_mime}')

    return value

def invoice_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    new_filename = f"{uuid.uuid4().hex}{ext}"
    folder = 'pdf' if ext == '.pdf' else 'images'
    return f'invoices/user_{instance.uploaded_by.id}/{folder}/{new_filename}'

class Company(models.Model):
    name = models.CharField(max_length=255, unique=True)
    tax_code = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Companies'

class InvoiceNew(models.Model):
    class DocumentType(models.TextChoices):
        VAT_INVOICE = 'invoice', 'Hóa đơn VAT'
        RECEIPT = 'receipt', 'Phiếu thu'
        PAYMENT = 'payment', 'Phiếu chi'
        WAREHOUSE = 'warehouse', 'Phiếu nhập kho'

    class OCRStatus(models.TextChoices):
        PENDING = 'pending', 'Chờ xử lý'
        PROCESSING = 'processing', 'Đang xử lý'
        DONE = 'done', 'Hoàn thành'
        FAILED = 'failed', 'Thất bại'
    
    class Source(models.TextChoices):
        MANUAL = 'manual', 'Nhập thủ công'
        AI = 'ai', 'Import AI'
        GEMINI = 'gemini', 'Google Gemini'

    uploaded_by = models.ForeignKey(Users, on_delete=models.CASCADE, related_name='invoices_upgrades')
    document_type = models.CharField(max_length=20, choices=DocumentType.choices, default=DocumentType.VAT_INVOICE)
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices_upgrades')
    file = models.FileField(upload_to=invoice_upload_path, validators=[validate_file_type])
    note = models.TextField(blank=True, default='')
    ocr_status = models.CharField(max_length=20, choices=OCRStatus.choices, default=OCRStatus.PENDING)
    ocr_result = models.JSONField(null=True, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.uploaded_by.email} - {self.created_at.date()}"

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Invoices'


class VATInvoiceDetail(models.Model):
    invoice = models.OneToOneField(InvoiceNew, on_delete=models.CASCADE, related_name='vat_detail')
    invoice_date = models.DateField(null=True, blank=True)
    seller_name = models.CharField(max_length=255, blank=True, default='')
    payment_method = models.CharField(max_length=100, blank=True, default='')
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_discount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    received_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    change_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"Hóa đơn - {self.seller_name} - {self.invoice_date}"

class VATInvoiceItem(models.Model):
    vat_invoice = models.ForeignKey(VATInvoiceDetail, on_delete=models.CASCADE, related_name='items' )
    item_name = models.CharField(max_length=255, blank=True, default='')
    unit = models.CharField(max_length=50, blank=True, default='')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, default='')

    def __str__(self):
        return f"{self.item_name} - {self.quantity} {self.unit}"

    class Meta:
        ordering = ['id']


class ReceiptDetail(models.Model):
    invoice = models.OneToOneField(InvoiceNew, on_delete=models.CASCADE, related_name='receipt_detail')
    invoice_code = models.CharField(max_length=100, blank=True, default='')
    receipt_date = models.DateField(null=True, blank=True)
    payer_name = models.CharField(max_length=255, blank=True, default='')
    payer_address = models.TextField(blank=True, default='')
    reason = models.TextField(blank=True, default='')
    payment_method = models.CharField(max_length=100, blank=True, default='')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    cashier = models.CharField(max_length=100, blank=True, default='')
    accountant = models.CharField(max_length=100, blank=True, default='')

    def __str__(self):
        return f"Phiếu thu - {self.invoice_code}"


class PaymentDetail(models.Model):
    invoice = models.OneToOneField(InvoiceNew, on_delete=models.CASCADE, related_name='payment_detail')
    invoice_code = models.CharField(max_length=100, blank=True, default='')
    payment_date = models.DateField(null=True, blank=True)
    payee_name = models.CharField(max_length=255, blank=True, default='')
    payee_address = models.TextField(blank=True, default='')
    reason = models.TextField(blank=True, default='')
    payment_method = models.CharField(max_length=100, blank=True, default='')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    cashier = models.CharField(max_length=100, blank=True, default='')
    accountant = models.CharField(max_length=100, blank=True, default='')

    def __str__(self):
        return f"Phiếu chi - {self.invoice_code}"


class WarehouseDetail(models.Model):
    invoice = models.OneToOneField(InvoiceNew, on_delete=models.CASCADE, related_name='warehouse_detail')
    invoice_code = models.CharField(max_length=100, blank=True, default='')
    warehouse_date = models.DateField(null=True, blank=True)
    warehouse_name = models.CharField(max_length=255, blank=True, default='')
    supplier_name = models.CharField(max_length=255, blank=True, default='')
    supplier_address = models.TextField(blank=True, default='')
    delivery_person = models.CharField(max_length=100, blank=True, default='')
    total_quantity = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    warehouse_keeper = models.CharField(max_length=100, blank=True, default='')
    accountant = models.CharField(max_length=100, blank=True, default='')

    def __str__(self):
        return f"Nhập kho - {self.invoice_code}"

class WarehouseItem(models.Model):
    warehouse_detail = models.ForeignKey(WarehouseDetail, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=255, blank=True, default='')
    unit = models.CharField(max_length=50, blank=True, default='')
    quantity = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    total_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    note = models.CharField(max_length=255, blank=True, default='')

    def __str__(self):
        return f"{self.item_name} - {self.quantity} {self.unit}"

    class Meta:
        ordering = ['id']