import json
from decimal import Decimal
from datetime import date, datetime

class DecimalDateEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        return super().default(obj)

def safe_json_dumps(data):
    return json.dumps(data, cls=DecimalDateEncoder)

def sanitize_for_json(data):
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(i) for i in data]
    elif isinstance(data, Decimal):
        return float(data)
    elif isinstance(data, (date, datetime)):
        return data.isoformat()
    else:
        return data