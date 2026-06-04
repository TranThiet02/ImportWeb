# invoicegemini/gemini_service.py
import os
import json
import base64
import re
import logging
from django.conf import settings
import google.generativeai as genai


logger = logging.getLogger(__name__)


def _file_to_base64(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.pdf':
        from pdf2image import convert_from_path
        import io
        pages = convert_from_path(file_path, dpi=200)
        if not pages:
            raise Exception("PDF không có trang nào")
        img_byte = io.BytesIO()
        pages[0].save(img_byte, format='PNG')
        return base64.b64encode(img_byte.getvalue()).decode('utf-8'), 'image/png'
    else:
        with open(file_path, 'rb') as f:
            img_bytes = f.read()
        mime_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}
        return base64.b64encode(img_bytes).decode('utf-8'), mime_map.get(ext, 'image/jpeg')


def extract_from_image_gemini(file_path, doc_type='invoice'):
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-3.5-flash')

    img_base64, mime_type = _file_to_base64(file_path)

    # Prompt theo từng loại chứng từ
    prompts = {
        'invoice': """Đọc hóa đơn/bill bán lẻ trong ảnh. Trả về JSON CHÍNH XÁC:
{
    "confidence_score": 85,
    "quality_note": "Mô tả chất lượng ảnh",
    "doc_type_detected": "invoice",
    "detail": {
        "seller_name": "tên cửa hàng hoặc null",
        "invoice_date": "YYYY-MM-DD hoặc null",
        "invoice_code": "số hóa đơn hoặc null",
        "payment_method": "Tiền mặt/Chuyển khoản/... hoặc null",
        "cashier": "tên thu ngân hoặc null",
        "subtotal": 0,
        "total_discount": 0,
        "tax_amount": 0,
        "total_amount": 0,
        "received_amount": 0,
        "change_amount": 0,
        "items": [
            {
                "item_name": "tên món/hàng",
                "unit": "đơn vị tính hoặc null",
                "quantity": 1,
                "unit_price": 0,
                "total_price": 0
            }
        ]
    }
}
Số tiền là số nguyên (không dấu phẩy).
Không đọc được thì null.
CHỈ trả về JSON, không markdown, không giải thích.""",

        'receipt': """Đọc phiếu thu trong ảnh. Trả về JSON CHÍNH XÁC:
{
    "confidence_score": 85,
    "quality_note": "Mô tả chất lượng ảnh",
    "doc_type_detected": "receipt",
    "detail": {
        "receipt_date": "YYYY-MM-DD hoặc null",
        "invoice_code": "số phiếu hoặc null",
        "payer_name": "tên người nộp hoặc null",
        "payer_address": "địa chỉ hoặc null",
        "reason": "lý do thu hoặc null",
        "payment_method": "Tiền mặt/Chuyển khoản/... hoặc null",
        "total_amount": 0,
        "cashier": "tên thu ngân hoặc null",
        "accountant": "tên kế toán hoặc null"
    }
}
CHỈ trả về JSON.""",

        'payment': """Đọc phiếu chi trong ảnh. Trả về JSON CHÍNH XÁC:
{
    "confidence_score": 85,
    "quality_note": "Mô tả chất lượng ảnh",
    "doc_type_detected": "payment",
    "detail": {
        "payment_date": "YYYY-MM-DD hoặc null",
        "invoice_code": "số phiếu hoặc null",
        "payee_name": "tên người nhận hoặc null",
        "payee_address": "địa chỉ hoặc null",
        "reason": "lý do chi hoặc null",
        "payment_method": "Tiền mặt/Chuyển khoản/... hoặc null",
        "total_amount": 0,
        "cashier": "tên thủ quỹ hoặc null",
        "accountant": "tên kế toán hoặc null"
    }
}
CHỈ trả về JSON.""",

        'warehouse': """Đọc phiếu nhập kho trong ảnh. Trả về JSON CHÍNH XÁC:
{
    "confidence_score": 85,
    "quality_note": "Mô tả chất lượng ảnh",
    "doc_type_detected": "warehouse",
    "detail": {
        "warehouse_date": "YYYY-MM-DD hoặc null",
        "invoice_code": "số phiếu hoặc null",
        "warehouse_name": "tên kho hoặc null",
        "supplier_name": "tên nhà cung cấp hoặc null",
        "supplier_address": "địa chỉ hoặc null",
        "delivery_person": "người giao hàng hoặc null",
        "total_quantity": 0,
        "total_amount": 0,
        "warehouse_keeper": "thủ kho hoặc null",
        "accountant": "kế toán hoặc null",
        "items": [
            {
                "item_name": "tên hàng",
                "unit": "đơn vị",
                "quantity": 0,
                "unit_price": 0,
                "total_price": 0
            }
        ]
    }
}
CHỈ trả về JSON.""",
    }

    prompt = prompts.get(doc_type, prompts['invoice'])

    try:
        response = model.generate_content([
            {'mime_type': mime_type, 'data': img_base64},
            prompt
        ])

        raw = response.text.strip()
        logger.info(f"Gemini raw response: {raw[:200]}")

        raw = re.sub(r'```json\s*', '', raw)
        raw = re.sub(r'```\s*', '', raw)
        raw = raw.strip()

        # Parse JSON
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            # Thử tìm JSON trong response
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                parsed = json.loads(match.group())
            else:
                raise Exception(f"Không parse được JSON từ Gemini: {raw[:200]}")

        confidence  = parsed.get('confidence_score', 70)
        quality_note = parsed.get('quality_note', '')
        detail = parsed.get('detail', {})

        # Kiểm tra detail có dữ liệu không
        if not detail:
            logger.warning("Gemini trả về detail rỗng!")
            confidence = min(confidence, 30)

        logger.info(f"Confidence: {confidence}%")
        logger.info(f"Detail keys: {list(detail.keys())}")
        logger.info(f"Total amount: {detail.get('total_amount')}")

        return {
            'confidence_score': confidence,
            'quality_note': quality_note,
            'detail': detail,
            'raw_response': raw[:500], 
        }

    except Exception as e:
        logger.error(f"Gemini error: {str(e)}")
        raise


def _normalize_detail(detail, doc_type):
    if not detail:
        return {}

    result = dict(detail)

    # Chuẩn hóa số tiền
    amount_fields = [
        'total_amount', 'subtotal', 'tax_amount',
        'total_discount', 'received_amount', 'change_amount',
        'unit_price', 'total_price', 'quantity', 'total_quantity'
    ]

    for field in amount_fields:
        if field in result:
            val = result[field]
            if val in [None, '', 'null', 'None']:
                result[field] = None
            else:
                try:
                    # Loại bỏ dấu phẩy và khoảng trắng
                    if isinstance(val, str):
                        val = val.replace(',', '').replace(' ', '').replace('đ', '')
                    result[field] = float(val) if val else None
                except (ValueError, TypeError):
                    result[field] = None

    # Chuẩn hóa ngày
    date_fields = ['invoice_date', 'receipt_date', 'payment_date', 'warehouse_date']
    for field in date_fields:
        if field in result and result[field]:
            val = str(result[field])
            # Thử parse nhiều format ngày
            try:
                from datetime import datetime
                for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d']:
                    try:
                        dt = datetime.strptime(val.strip(), fmt)
                        result[field] = dt.strftime('%Y-%m-%d')
                        break
                    except ValueError:
                        continue
            except Exception:
                result[field] = None

    # Chuẩn hóa items
    if 'items' in result and isinstance(result['items'], list):
        normalized_items = []
        for item in result['items']:
            if not isinstance(item, dict):
                continue
            norm_item = dict(item)
            
            for str_field in ['item_name', 'unit']:
                if norm_item.get(str_field) is None:
                    norm_item[str_field] = ''

            for field in ['quantity', 'unit_price', 'total_price']:
                val = norm_item.get(field)
                if val in [None, '', 'null']:
                    norm_item[field] = None
                else:
                    try:
                        if isinstance(val, str):
                            val = val.replace(',', '').replace(' ', '')
                        norm_item[field] = float(val) if val else None
                    except (ValueError, TypeError):
                        norm_item[field] = None
            normalized_items.append(norm_item)
        result['items'] = normalized_items

    return result