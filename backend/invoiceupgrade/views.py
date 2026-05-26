import os
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
import json
from .models import InvoiceNew, Company
from .serializers import InvoiceNewSerializer, CompanySerializer

DECIMAL_FIELDS = [
    'total_amount', 'total_before_tax', 'tax_rate', 'tax_amount',
    'total_quantity', 'quantity', 'unit_price', 'total_price'
]

def clean_decimal_fields(data):
    if not isinstance(data, dict):
        return data

    for field in DECIMAL_FIELDS:
        if field in data and data[field] == '':
            data[field] = None

    if 'items' in data and isinstance(data['items'], list):
        for item in data['items']:
            for field in DECIMAL_FIELDS:
                if field in item and item[field] == '':
                    item[field] = None

    return data

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def invoice_list(request):

    if request.method == 'GET':
        invoices = InvoiceNew.objects.filter(
            uploaded_by=request.user,
            source='manual'
        ).select_related(
            'uploaded_by', 'company',
            'vat_detail', 'receipt_detail',
            'payment_detail', 'warehouse_detail',
        ).prefetch_related(
            'warehouse_detail__items',
            'vat_detail__items',
        )

        doc_type = request.query_params.get('document_type', None)
        ocr_status = request.query_params.get('ocr_status', None)
        search = request.query_params.get('search', None)
        ordering = request.query_params.get('ordering', '-created_at')

        if doc_type:
            invoices = invoices.filter(document_type=doc_type)
        if ocr_status:
            invoices = invoices.filter(ocr_status=ocr_status)
        if search:
            invoices = invoices.filter(note__icontains=search)

        invoices = invoices.order_by(ordering)
        serializer = InvoiceNewSerializer(invoices, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        detail_data_raw = request.data.get('detail_data', '{}')
        try:
            detail_data_parsed = json.loads(detail_data_raw) if isinstance(detail_data_raw, str) else detail_data_raw
        except json.JSONDecodeError:
            detail_data_parsed = {}

        detail_data_parsed = clean_decimal_fields(detail_data_parsed)

        data = {
            'file': request.data.get('file'),
            'document_type': request.data.get('document_type'),
            'company_name': request.data.get('company_name', ''),
            'note': request.data.get('note', ''),
            'detail_data': detail_data_parsed,
            'source': 'manual',
        }

        serializer = InvoiceNewSerializer(data=data)
        if serializer.is_valid():
            serializer.save(uploaded_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def invoice_detail(request, pk):
    try:
        invoice = InvoiceNew.objects.select_related(
            'uploaded_by', 'company', 'vat_detail',
            'receipt_detail', 'payment_detail', 'warehouse_detail'
        ).prefetch_related(
            'warehouse_detail__items',
            'vat_detail__items',
        ).get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = InvoiceNewSerializer(invoice)
        return Response(serializer.data)

    elif request.method == 'PUT':
        detail_data_raw = request.data.get('detail_data', '{}')
        try:
            detail_data_parsed = json.loads(detail_data_raw) if isinstance(detail_data_raw, str) else detail_data_raw
        except json.JSONDecodeError:
            detail_data_parsed = {}

        data = {
            'document_type': request.data.get('document_type'),
            'company_name': request.data.get('company_name', ''),
            'note': request.data.get('note', ''),
            'detail_data': detail_data_parsed,
        }
        if 'file' in request.data:
            data['file'] = request.data.get('file')

        serializer = InvoiceNewSerializer(invoice, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        if invoice.file:
            if os.path.isfile(invoice.file.path):
                os.remove(invoice.file.path)
        invoice.delete()
        return Response({'message': 'Xóa thành công'}, status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def company_list(request):
    if request.method == 'GET':
        search    = request.query_params.get('search', None)
        companies = Company.objects.all()
        if search:
            companies = companies.filter(name__icontains=search)
        serializer = CompanySerializer(companies, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = CompanySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def company_detail(request, pk):
    try:
        company = Company.objects.get(pk=pk)
    except Company.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(CompanySerializer(company).data)

    elif request.method == 'PUT':
        serializer = CompanySerializer(company, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        company.delete()
        return Response({'message': 'Đã xóa'}, status=status.HTTP_204_NO_CONTENT)