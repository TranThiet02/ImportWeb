import os
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse, Http404
import json
from .models import InvoiceNew, Company
from .serializers import InvoiceNewSerializer, CompanySerializer
from .quality_checker import run_quality_check
from .image_verifier import run_image_verification
from .utils import sanitize_for_json

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
            updated_invoice = serializer.save()
            if updated_invoice.ocr_status in ['failed', 'pending']:
                updated_invoice.ocr_status = 'done'
                current_result = updated_invoice.ocr_result or {}
                updated_invoice.ocr_result = {
                    **current_result,
                    'auto_saved': True,
                    'progress': 'Đã nhập thủ công',
                    'percent': 100,
                    'manual_edit': True,
                }
                updated_invoice.save()
            return Response(InvoiceNewSerializer(updated_invoice).data)
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
        search = request.query_params.get('search', None)
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
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def serve_invoice_file(request, pk):
    try:
        invoice = InvoiceNew.objects.get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        raise Http404("Không tìm thấy file")

    file_path = invoice.file.path
    if not os.path.exists(file_path):
        raise Http404("File không tồn tại")

    response = FileResponse(open(file_path, 'rb'), as_attachment=False)

    response['X-Content-Type-Options'] = 'nosniff'
    response['Content-Security-Policy'] = "default-src 'none'"

    return response

# @api_view(['GET'])
# @permission_classes([IsAuthenticated])
# def audit_invoice(request, pk):
#     """
#     Chạy AI Invoice Auditor cho 1 hóa đơn
#     GET /userup/invoicesup/<pk>/audit/
#     """
#     try:
#         # Kiểm tra invoice thuộc về user
#         from .models import InvoiceNew
#         InvoiceNew.objects.get(pk=pk, uploaded_by=request.user)
#     except InvoiceNew.DoesNotExist:
#         return Response({'error': 'Không tìm thấy'}, status=404)

#     try:
#         result = run_auditor(pk, request.user)
#         return Response(result)
#     except Exception as e:
#         return Response(
#             {'error': f'Lỗi khi audit: {str(e)}'},
#             status=status.HTTP_500_INTERNAL_SERVER_ERROR
#         )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quality_check_invoice(request, pk):
    try:
        InvoiceNew.objects.get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=404)

    try:
        result = run_quality_check(pk, request.user)
        return Response(result)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verify_invoice_image(request, pk):
    try:
        from .models import InvoiceNew
        InvoiceNew.objects.get(pk=pk, uploaded_by=request.user)
    except InvoiceNew.DoesNotExist:
        return Response({'error': 'Không tìm thấy'}, status=404)

    try:
        result = run_image_verification(pk, request.user)
        return Response(result)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quality_check_all(request):
    source = request.GET.get('source', None)

    invoices = InvoiceNew.objects.select_related(
        'company', 'vat_detail', 'receipt_detail',
        'payment_detail', 'warehouse_detail',
    ).prefetch_related(
        'vat_detail__items',
        'warehouse_detail__items',
    ).filter(uploaded_by=request.user)

    if source:
        invoices = invoices.filter(source=source)

    invoices = invoices.order_by('-created_at')

    results = []
    summary = {
        'total': 0,
        'valid': 0,
        'warning': 0,
        'invalid': 0,
        'ocr_failed': 0,
        'ocr_processing': 0,
        'no_data': 0,
    }

    for invoice in invoices:
        try:
            result = run_quality_check(invoice.id, request.user)
            results.append({
                'invoice_id': invoice.id,
                'source': invoice.source,
                'document_type': invoice.document_type,
                'company': invoice.company.name if invoice.company else '—',
                'created_at': invoice.created_at,
                'file': invoice.file.url if invoice.file else None,
                'ocr_status': invoice.ocr_status,
                'status': result['status'],
                'status_label': result['status_label'],
                'can_save': result['can_save'],
                'issues': result['issues'],
                'summary': result['summary'],
            })

            summary['total'] += 1
            if result['status'] == 'valid':
                summary['valid'] += 1
            elif result['status'] == 'warning':
                summary['warning'] += 1
            else:
                summary['invalid'] += 1
            
            if invoice.ocr_status == 'failed':
                summary['ocr_failed'] += 1
            elif invoice.ocr_status == 'processing':
                summary['ocr_processing'] += 1

        except Exception as e:
            results.append({
                'invoice_id': invoice.id,
                'source': invoice.source,
                'document_type': invoice.document_type,
                'company': invoice.company.name if invoice.company else '—',
                'created_at': invoice.created_at.isoformat(),
                'file': invoice.file.url if invoice.file else None,
                'ocr_status': invoice.ocr_status,
                'status': 'invalid',
                'status_label':  f'Lỗi hệ thống',
                'can_save': False,
                'issues': [{
                    'field': 'system',
                    'level': 'error',
                    'message': f'Lỗi khi kiểm tra: {str(e)[:100]}',
                    'suggestion': 'Liên hệ admin hoặc thử lại'
                }],
                'summary': {
                    'total': 1, 'errors': 1, 'warnings': 0, 'infos': 0
                },
            })
            summary['total'] += 1
            summary['invalid'] += 1

    priority_map = {'invalid': 0, 'warning': 1, 'valid': 2}
    results.sort(key=lambda x: priority_map.get(x['status'], 0))

    return Response(sanitize_for_json({
        'summary': summary,
        'results': results,
    }))