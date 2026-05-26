from ultralytics import YOLO
import cv2

model   = YOLO(r'ai_model_yolo_paddle\model_yolo\best.pt')
results = model('test.jpg', conf=0.3)  # Giảm conf xuống 0.3

print("\n🔍 Tất cả detection:")
for box in results[0].boxes:
    name = results[0].names[int(box.cls)]
    conf = float(box.conf)
    print(f"  {name:25s}: {conf:.1%}")

results[0].save(filename='result_debug.jpg')
print("\n✅ Xem ảnh result_debug.jpg để thấy bounding boxes")