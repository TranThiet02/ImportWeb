import os
import cv2
import re
import numpy as np
from datetime import datetime
from ultralytics import YOLO
from pdf2image import convert_from_path
from django.conf import settings
import easyocr 

FIELD_MAPPING = {
    'SHOP_NAME': 'seller_name',
    'DATETIME': 'invoice_date',
    'BILLID': 'invoice_code',
    'ADDR': 'seller_address',
    'PHONE': 'seller_phone',
    'CASHIER': 'cashier',
    'SUB_TPRICE': 'subtotal',
    'TDISCOUNT': 'total_discount',
    'TPRICE': 'total_amount',
    'AMOUNT': 'tax_amount',
    'TAMOUNT': 'tax_amount',
    'RECEMONEY': 'received_amount',
    'REMAMONEY': 'change_amount',
    'FAX': 'seller_fax',
    'NUMBER': 'invoice_number',
    'PRODUCT_NAME': 'item_name',
    'UPRICE': 'unit_price',
    'FPRICE': 'total_price',
    'UDISCOUNT': 'item_discount',
    'UNIT': 'unit',
    'ADDR_PREFIX': None,
    'AMOUNT_PREFIX': None,
    'BILLID_PREFIX': None,
    'CASHIER_PREFIX': None,
    'DATETIME_PREFIX': None,
    'FAX_PREFIX': None,
    'FPRICE_PREFIX': None,
    'NUMBER_PREFIX': None,
    'PHONE_PREFIX': None,
    'PRODUCT_NAME_PREFIX': None,
    'RECEMONEY_PREFIX': None,
    'REMAMONEY_PREFIX': None,
    'SUB_TPRICE_PREFIX': None,
    'TAMOUNT_PREFIX': None,
    'TDISCOUNT_PREFIX': None,
    'TPRICE_PREFIX': None,
    'UDISCOUNT_PREFIX': None,
    'UNIT_PREFIX': None,
    'UPRICE_PREFIX': None,
    'TITLE': None,
    'OTHER': None,
    'D': None,
    'a': None,
    'ct': None,
    'fa': None,
}

ITEM_FIELDS  = {'item_name', 'unit_price', 'total_price', 'item_discount', 'unit'}
MONEY_FIELDS = {
    'subtotal', 'total_discount', 'total_amount',
    'tax_amount', 'received_amount', 'change_amount',
    'unit_price', 'total_price', 'item_discount',
}

class ModelManager:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
            cls._instance._load()
        return cls._instance

    def _load(self):
        print("Loading AI models...")

        yolo_path = settings.AI_MODELS['detect_bill']
        if not os.path.exists(yolo_path):
            raise FileNotFoundError(f"Không tìm thấy: {yolo_path}")
        self.yolo = YOLO(yolo_path)
        print("YOLO loaded")

        self.ocr = easyocr.Reader(['vi', 'en'], gpu=False)
        print("EasyOCR loaded")


def clean_money(text):
    if not text:
        return None
    cleaned = re.sub(r'[^\d]', '', str(text))
    return int(cleaned) if cleaned else None


def clean_date(text):
    if not text:
        return None
    patterns = [
        r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})',
        r'(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})',
    ]
    for pattern in patterns:
        match = re.search(pattern, str(text))
        if match:
            g = match.groups()
            try:
                if len(g[0]) == 4:
                    date = datetime(int(g[0]), int(g[1]), int(g[2]))
                else:
                    date = datetime(int(g[2]), int(g[1]), int(g[0]))
                return date.strftime('%Y-%m-%d')
            except:
                continue
    return text


def ocr_crop(ocr_engine, image, coords):
    h, w = image.shape[:2]
    x1, y1, x2, y2 = coords

    x1 = max(0, x1 - 5)
    y1 = max(0, y1 - 5)
    x2 = min(w, x2 + 5)
    y2 = min(h, y2 + 5)

    cropped = image[y1:y2, x1:x2]
    if cropped.size == 0:
        return ''

    result = ocr_engine.readtext(cropped, detail=1)

    if result:
        texts = [item[1] for item in result if item[2] > 0.5]
        return ' '.join(texts).strip()
    return ''


def load_image(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        pages = convert_from_path(file_path, dpi=300)
        if not pages:
            raise Exception("PDF không có trang nào")
        image = cv2.cvtColor(np.array(pages[0]), cv2.COLOR_RGB2BGR)
    else:
        image = cv2.imread(file_path)
        if image is None:
            raise Exception(f"Không đọc được: {file_path}")
    return image

def preprocess_image(image):
    h, w = image.shape[:2]
    if max(h, w) > 1280:
        scale = 1280 / max(h, w)
        image = cv2.resize(image, (int(w*scale), int(h*scale)))
    gray     = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe    = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

def detect_all_regions(image):
    manager = ModelManager.get_instance()
    results = manager.yolo(image, conf=0.3)

    single_regions = {}
    item_regions = {}

    for box in results[0].boxes:
        yolo_class = results[0].names[int(box.cls)]
        field_name = FIELD_MAPPING.get(yolo_class)

        if field_name is None:
            continue

        coords = [int(c) for c in box.xyxy[0].tolist()]
        confidence = float(box.conf)
        y_center = (coords[1] + coords[3]) / 2

        if field_name in ITEM_FIELDS:
            if field_name not in item_regions:
                item_regions[field_name] = []
            item_regions[field_name].append({
                'coords': coords,
                'confidence': confidence,
                'y_center': y_center,
            })
        else:
            if field_name not in single_regions:
                single_regions[field_name] = {'coords': coords, 'confidence': confidence}
            elif confidence > single_regions[field_name]['confidence']:
                single_regions[field_name] = {'coords': coords, 'confidence': confidence}

    for field in item_regions:
        item_regions[field].sort(key=lambda x: x['y_center'])

    return single_regions, item_regions


def ocr_single_fields(image, single_regions):
    manager = ModelManager.get_instance()
    results = {}

    for field_name, info in single_regions.items():
        text = ocr_crop(manager.ocr, image, info['coords'])

        if field_name in MONEY_FIELDS:
            value = clean_money(text)
        elif field_name == 'invoice_date':
            value = clean_date(text)
        else:
            value = text

        results[field_name] = {
            'value': value,
            'raw': text,
            'confidence': info['confidence'],
        }

    return results


def ocr_item_fields(image, item_regions):
    manager = ModelManager.get_instance()
    items = []

    ocr_items = {}
    for field_name, region_list in item_regions.items():
        ocr_items[field_name] = []
        for region in region_list:
            text = ocr_crop(manager.ocr, image, region['coords'])
            ocr_items[field_name].append({
                'text':     text,
                'y_center': region['y_center'],
            })

    item_count = len(ocr_items.get('item_name', []))

    for i in range(item_count):
        def get_text(field):
            lst = ocr_items.get(field, [])
            return lst[i]['text'] if i < len(lst) else ''

        item = {
            'item_name': get_text('item_name'),
            'unit': get_text('unit'),
            'unit_price': clean_money(get_text('unit_price')),
            'total_price': clean_money(get_text('total_price')),
            'quantity': None,
            'tax_rate': None,
        }
        items.append(item)

    return items

def run_ocr_pipeline(file_path):
    image     = load_image(file_path)
    processed = preprocess_image(image)

    single_regions, item_regions = detect_all_regions(processed)
    print(f"Single fields: {list(single_regions.keys())}")
    print(f"Item fields:   {list(item_regions.keys())}")

    single_data = ocr_single_fields(image, single_regions)
    items       = ocr_item_fields(image, item_regions)

    def get_val(field):
        return single_data.get(field, {}).get('value')

    result = {
        'document_type': 'invoice',
        'company_name':  get_val('seller_name') or '',
        'fields': single_data,
        'detail': {
            'invoice_date': get_val('invoice_date'),
            'seller_name': get_val('seller_name') or '',
            'seller_address': get_val('seller_address') or '',
            'payment_method': get_val('payment_method') or '',
            'subtotal': get_val('subtotal'),
            'total_discount': get_val('total_discount'),
            'tax_amount': get_val('tax_amount'),
            'total_amount': get_val('total_amount'),
            'received_amount': get_val('received_amount'),
            'change_amount': get_val('change_amount'),
            'cashier': get_val('cashier') or '',
            'items': items,
        }
    }

    return result