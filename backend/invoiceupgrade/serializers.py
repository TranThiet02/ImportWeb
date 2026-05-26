from rest_framework import serializers
from .models import (InvoiceNew, VATInvoiceDetail, ReceiptDetail, PaymentDetail, WarehouseDetail, WarehouseItem, Company, VATInvoiceItem)

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'name', 'tax_code']

class WarehouseItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseItem
        fields = [
            'id', 'item_name', 'unit',
            'quantity', 'unit_price', 'total_price', 'note'
        ]


class VATInvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VATInvoiceItem
        fields = [
            'id', 'item_name', 'unit',
            'quantity', 'unit_price',
            'total_price', 'tax_rate', 'note'
        ]

class VATInvoiceDetailSerializer(serializers.ModelSerializer):
    items = VATInvoiceItemSerializer(many=True, required=False)
    class Meta:
        model = VATInvoiceDetail
        exclude = ['invoice']


class ReceiptDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReceiptDetail
        exclude = ['invoice']


class PaymentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentDetail
        exclude = ['invoice']


class WarehouseDetailSerializer(serializers.ModelSerializer):
    items = WarehouseItemSerializer(many=True, required=False)

    class Meta:
        model = WarehouseDetail
        exclude = ['invoice']


class InvoiceNewSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(source='uploaded_by.email', read_only=True)
    company_detail = CompanySerializer(source='company', read_only=True)
    company_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vat_detail = VATInvoiceDetailSerializer(read_only=True)
    receipt_detail = ReceiptDetailSerializer(read_only=True)
    payment_detail = PaymentDetailSerializer(read_only=True)
    warehouse_detail = WarehouseDetailSerializer(read_only=True)
    detail_data = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = InvoiceNew
        fields = [
            'id',
            'uploaded_by_email',
            'document_type',
            'company_name',
            'company_detail',
            'file',
            'note',
            'ocr_status',
            'ocr_result',
            'detail_data',
            'vat_detail',
            'receipt_detail',
            'payment_detail',
            'warehouse_detail',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'ocr_status', 'ocr_result',
            'created_at', 'updated_at', 'uploaded_by_email'
        ]

    def validate_file(self, value):
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File không được vượt quá 10MB")
        allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError("Chỉ chấp nhận PDF, JPG, PNG")
        return value

    def create(self, validated_data):
        company_name = validated_data.pop('company_name', None)
        detail_data = validated_data.pop('detail_data', {})

        if company_name:
            company, created = Company.objects.get_or_create(name=company_name)
            validated_data['company'] = company

        invoice = InvoiceNew.objects.create(**validated_data)

        self._create_detail(invoice, detail_data)
        return invoice

    def update(self, instance, validated_data):
        company_name = validated_data.pop('company_name', None)
        detail_data = validated_data.pop('detail_data', {})

        if company_name:
            company, created = Company.objects.get_or_create(name=company_name)
            instance.company = company

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        self._update_detail(instance, detail_data)
        return instance

    def _create_detail(self, invoice, detail_data):
        if invoice.document_type == 'invoice':
            items = detail_data.pop('items', [])
            vat = VATInvoiceDetail.objects.create(invoice=invoice, **detail_data)
            for item in items:
                VATInvoiceItem.objects.create(vat_invoice=vat, **item)

        elif invoice.document_type == 'receipt':
            ReceiptDetail.objects.create(invoice=invoice, **detail_data)

        elif invoice.document_type == 'payment':
            PaymentDetail.objects.create(invoice=invoice, **detail_data)

        elif invoice.document_type == 'warehouse':
            items = detail_data.pop('items', [])
            warehouse = WarehouseDetail.objects.create(invoice=invoice, **detail_data)
            for item in items:
                WarehouseItem.objects.create(warehouse_detail=warehouse, **item)

    def _update_detail(self, invoice, detail_data):
        if invoice.document_type == 'invoice' and hasattr(invoice, 'vat_detail'):
            items = detail_data.pop('items', None)
            for attr, value in detail_data.items():
                setattr(invoice.vat_detail, attr, value)
            invoice.vat_detail.save()
            if items is not None:
                invoice.vat_detail.items.all().delete()
                for item in items:
                    VATInvoiceItem.objects.create(
                        vat_invoice=invoice.vat_detail, **item
                    )

        elif invoice.document_type == 'receipt' and hasattr(invoice, 'receipt_detail'):
            for attr, value in detail_data.items():
                setattr(invoice.receipt_detail, attr, value)
            invoice.receipt_detail.save()

        elif invoice.document_type == 'payment' and hasattr(invoice, 'payment_detail'):
            for attr, value in detail_data.items():
                setattr(invoice.payment_detail, attr, value)
            invoice.payment_detail.save()

        elif invoice.document_type == 'warehouse' and hasattr(invoice, 'warehouse_detail'):
            items = detail_data.pop('items', None)
            for attr, value in detail_data.items():
                setattr(invoice.warehouse_detail, attr, value)
            invoice.warehouse_detail.save()
            if items is not None:
                invoice.warehouse_detail.items.all().delete()
                for item in items:
                    WarehouseItem.objects.create(
                        warehouse_detail=invoice.warehouse_detail, **item
                    )