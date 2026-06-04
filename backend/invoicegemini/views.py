import os
import json
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from invoiceupgrade.models import InvoiceNew
from invoiceupgrade.serializers import InvoiceNewSerializer
from .tasks import run_gemini_task
from invoiceupgrade.quality_checker import run_quality_check
from invoiceupgrade.image_verifier import run_image_verification

def clean_decimal_fields(data):
    DECIMAL_FIELDS = [
        'total_amount', 'subtotal', 'total_discount',
        'tax_amount', 'received_amount', 'change_amount',
        'quantity', 'unit_price', 'total_price', 'tax_rate',
        'total_quantity',
    ]
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
def invoice_gemini_list(request):
    if request.method == 'GET':
        invoices = InvoiceNew.objects.filter(
            uploaded_by=request.user,
            source='gemini'
        ).select_related(
            'uploaded_by', 'company',
            'vat_detail', 'receipt_detail',
            'payment_detail', 'warehouse_detail',
        ).prefetch_related(
            'vat_detail__items',
            'warehouse_detail__items',
        ).order_by('-created_at')

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
            'document_type': request.data.get('document_type', 'invoice'),
            'company_name': request.data.get('company_name', ''),
            'note': request.data.get('note', ''),
            'detail_data': detail_data_parsed,
            'source': 'gemini',
        }

        serializer = InvoiceNewSerializer(data=data)
        if serializer.is_valid():
            invoice = serializer.save(uploaded_by=request.user)
            run_gemini_task.delay(invoice.id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def invoice_gemini_status(request, pk):
    try:
        invoice = InvoiceNew.objects.select_related(
            'vat_detail', 'receipt_detail',
            'payment_detail', 'warehouse_detail',
        ).prefetch_related(
            'vat_detail__items',
            'warehouse_detail__items',
        ).get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=404)

    return Response({
        'ocr_status': invoice.ocr_status,
        'invoice':    InvoiceNewSerializer(invoice).data
    })


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def invoice_gemini_detail(request, pk):
    try:
        invoice = InvoiceNew.objects.select_related(
            'uploaded_by', 'company',
            'vat_detail', 'receipt_detail',
            'payment_detail', 'warehouse_detail',
        ).prefetch_related(
            'vat_detail__items',
            'warehouse_detail__items',
        ).get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=404)

    if request.method == 'GET':
        return Response(InvoiceNewSerializer(invoice).data)

    elif request.method == 'PUT':
        detail_data_raw = request.data.get('detail_data', '{}')
        try:
            detail_data_parsed = json.loads(detail_data_raw) if isinstance(detail_data_raw, str) else detail_data_raw
        except json.JSONDecodeError:
            detail_data_parsed = {}

        detail_data_parsed = clean_decimal_fields(detail_data_parsed)

        data = {
            'document_type': request.data.get('document_type', invoice.document_type),
            'company_name': request.data.get('company_name', ''),
            'note': request.data.get('note', ''),
            'detail_data': detail_data_parsed,
        }
        if 'file' in request.data:
            data['file'] = request.data.get('file')

        serializer = InvoiceNewSerializer(invoice, data=data, partial=True)
        if serializer.is_valid():
            updated_invoice = serializer.save()
            if updated_invoice.ocr_status in ['failed', 'pending']:
                updated_invoice.ocr_status = 'done'
                current_result = updated_invoice.ocr_result or {}
                updated_invoice.ocr_result = {
                    **current_result,
                    'auto_saved': True,
                    'progress': 'Đã sửa thủ công',
                    'percent': 100,
                    'manual_edit': True,
                }
                updated_invoice.save()
            return Response(InvoiceNewSerializer(updated_invoice).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        if invoice.file and os.path.isfile(invoice.file.path):
            os.remove(invoice.file.path)
        invoice.delete()
        return Response({'message': 'Xóa thành công'}, status=204)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quality_check_gemini(request, pk):
    try:
        InvoiceNew.objects.get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=404)

    try:
        result = run_quality_check(pk, request.user)
        return Response(result)
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_gemini_image(request, pk):
    try:
        InvoiceNew.objects.get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=404)
    try:
        result = run_image_verification(pk, request.user)
        return Response(result)
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def invoice_gemini_batch(request):
    files = request.FILES.getlist('files')
    document_type = request.data.get('document_type', 'invoice')
    note = request.data.get('note', '')

    if not files:
        return Response(
            {'error': 'Không có file nào được upload'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(files) > 5:
        return Response(
            {'error': 'Tối đa 5 file mỗi lần'},
            status=status.HTTP_400_BAD_REQUEST
        )

    created = []
    errors  = []

    for file in files:
        # Validate file
        allowed = ['application/pdf', 'image/jpeg', 'image/png']
        if file.content_type not in allowed:
            errors.append({
                'file': file.name,
                'error': 'Không hỗ trợ định dạng này'
            })
            continue

        if file.size > 10 * 1024 * 1024:
            errors.append({
                'file': file.name,
                'error': 'File > 10MB'
            })
            continue

        # Tạo invoice
        serializer = InvoiceNewSerializer(data={
            'file': file,
            'document_type': document_type,
            'note': note,
            'detail_data': {},
            'source': 'gemini',
        })

        if serializer.is_valid():
            invoice = serializer.save(uploaded_by=request.user)
            run_gemini_task.delay(invoice.id)
            created.append({
                'id':        invoice.id,
                'file_name': file.name,
                'status':    'processing',
            })
        else:
            errors.append({
                'file':  file.name,
                'error': str(serializer.errors)
            })

    return Response({
        'created': created,
        'errors':  errors,
        'total':   len(files),
        'success': len(created),
        'failed':  len(errors),
    }, status=status.HTTP_201_CREATED)
