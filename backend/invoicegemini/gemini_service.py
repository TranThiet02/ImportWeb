# invoicegemini/gemini_service.py
import os
import json
import base64
import re
import google.generativeai as genai
from django.conf import settings
from pdf2image import convert_from_path
from PIL import Image
import io

genai.configure(api_key=settings.GEMINI_API_KEY)

for m in genai.list_models():
    print(m.name)


def file_to_base64(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.pdf':
        pages = convert_from_path(file_path, dpi=300)
        if not pages:
            raise Exception("PDF không có trang nào")

        # Chuyển PIL Image → bytes
        img_byte_arr = io.BytesIO()
        pages[0].save(img_byte_arr, format='PNG')
        img_bytes = img_byte_arr.getvalue()

        return base64.b64encode(img_bytes).decode('utf-8'), 'image/png'
    else:
        with open(file_path, 'rb') as f:
            img_bytes = f.read()

        # Xác định MIME type
        mime_map = {
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png':  'image/png',
        }
        mime_type = mime_map.get(ext, 'image/jpeg')

        return base64.b64encode(img_bytes).decode('utf-8'), mime_type


def analyze_with_gemini(file_path):
    """
    Gửi ảnh hóa đơn lên Gemini Vision
    Gemini đọc trực tiếp từ ảnh → chính xác hơn OCR text
    """
    img_base64, mime_type = file_to_base64(file_path)

    model = genai.GenerativeModel('gemini-3.5-flash')

    prompt = """Bạn là chuyên gia kế toán Việt Nam. 
Hãy đọc hóa đơn/bill trong ảnh và trả về JSON.
CHỈ trả về JSON, không giải thích thêm.

Xác định document_type:
- "invoice": Hóa đơn bán lẻ, bill cafe, nhà hàng, siêu thị
- "receipt": Phiếu thu tiền
- "payment": Phiếu chi tiền  
- "warehouse": Phiếu nhập kho

Trả về JSON với cấu trúc:
{
    "document_type": "invoice|receipt|payment|warehouse",
    "company_name": "tên cửa hàng/công ty",
    "confidence": 0.95,
    "detail": {
        "invoice_date": "YYYY-MM-DD hoặc null",
        "seller_name": "tên người bán/cửa hàng",
        "seller_address": "địa chỉ",
        "seller_phone": "số điện thoại",
        "invoice_code": "mã hóa đơn/số bill",
        "cashier": "tên thu ngân",
        "payment_method": "tiền mặt/chuyển khoản/...",
        "subtotal": số nguyên hoặc null,
        "total_discount": số nguyên hoặc null,
        "tax_amount": số nguyên hoặc null,
        "total_amount": số nguyên hoặc null,
        "received_amount": số nguyên hoặc null,
        "change_amount": số nguyên hoặc null,
        "payer_name": "tên người nộp (nếu là phiếu thu)",
        "payer_address": "địa chỉ người nộp",
        "payee_name": "tên người nhận (nếu là phiếu chi)",
        "payee_address": "địa chỉ người nhận",
        "reason": "lý do thu/chi",
        "accountant": "kế toán",
        "warehouse_name": "tên kho (nếu là phiếu nhập kho)",
        "supplier_name": "nhà cung cấp",
        "supplier_address": "địa chỉ NCC",
        "delivery_person": "người giao hàng",
        "warehouse_keeper": "thủ kho",
        "total_quantity": số nguyên hoặc null,
        "items": [
            {
                "item_name": "tên sản phẩm/dịch vụ",
                "unit": "đơn vị tính",
                "quantity": số hoặc null,
                "unit_price": số nguyên hoặc null,
                "total_price": số nguyên hoặc null,
                "discount": số nguyên hoặc null
            }
        ]
    }
}

Lưu ý quan trọng:
- Số tiền: số nguyên không dấu phẩy (35000 thay vì 35,000)
- Ngày: YYYY-MM-DD (2025-05-16 thay vì 16/05/2025)
- Field không đọc được: null (số) hoặc "" (chuỗi)
- items: danh sách tất cả sản phẩm trong bill
- Chỉ trả về JSON thuần, không markdown"""

    response = model.generate_content([
        {
            'mime_type': mime_type,
            'data': img_base64
        },
        prompt
    ])

    raw_text = response.text.strip()

    raw_text = raw_text.replace('```json', '').replace('```', '').strip()

    try:
        result = json.loads(raw_text)
        return result
    except json.JSONDecodeError:
        json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        raise Exception(f"Gemini trả về không phải JSON: {raw_text[:200]}")


def run_gemini_pipeline(file_path):
    result = analyze_with_gemini(file_path)
    return result