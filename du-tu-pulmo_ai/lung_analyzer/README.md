# 🏥 Lung Diagnosis API v3.1.0

Flask API phân tích X-Quang phổi sử dụng **YOLO11** + hệ thống **Threshold-based Priority Rules**.

## 🤖 Model

- **Architecture**: YOLO11-L
- **Dataset**: VinBigData (14 disease labels)
- **Weights**: `model/train/weights/best.pt`

## 📊 Hệ thống chẩn đoán

### 14 Bệnh lý được hỗ trợ

| ID | Label | Tên tiếng Việt | Ngưỡng | Nhóm nguy cơ |
|----|-------|---------------|--------|--------------|
| 12 | Pneumothorax | Tràn khí màng phổi | ≥0.60 | 🔴 **Critical** |
| 8 | Nodule/Mass | Nốt / Khối u | ≥0.70 | 🟠 High Risk |
| 10 | Pleural effusion | Tràn dịch màng phổi | ≥0.75 | 🟠 High Risk |
| 4 | Consolidation | Đông đặc phổi | ≥0.75 | 🟠 High Risk |
| 6 | Infiltration | Thâm nhiễm | ≥0.75 | 🟠 High Risk |
| 1 | Atelectasis | Xẹp phổi | ≥0.75 | 🟠 High Risk |
| 5 | ILD | Bệnh phổi mô kẽ | ≥0.75 | 🟡 Warning |
| 13 | Pulmonary fibrosis | Xơ phổi | ≥0.75 | 🟡 Warning |
| 3 | Cardiomegaly | Bóng tim to | ≥0.75 | 🟡 Warning |
| 7 | Lung Opacity | Mờ phế trường | ≥0.75 | 🟡 Warning |
| 11 | Pleural thickening | Dày màng phổi | ≥0.75 | 🟡 Warning |
| 0 | Aortic enlargement | Phình/Giãn ĐM chủ | ≥0.80 | 🟢 Benign |
| 2 | Calcification | Vôi hóa | ≥0.80 | 🟢 Benign |
| 9 | Other lesion | Tổn thương khác | ≥0.80 | 🟢 Benign |

### Risk Levels & Colors

| Level | Màu | Mô tả |
|-------|------|-------|
| Critical | `#DC0000` 🔴 | CẤP CỨU NGAY |
| High Risk | `#FF4500` 🟠 | Khám trong 3-7 ngày |
| Warning | `#FFA500` 🟡 | Theo dõi 2-4 tuần |
| Benign | `#00CC66` 🟢 | Theo dõi định kỳ |
| Uncertain | `#808080` ⚪ | Vùng xám / Không rõ |

### Confidence Levels

| Nhóm | High | Medium |
|------|------|--------|
| Pneumothorax | ≥0.80 | 0.60-0.79 |
| High Risk & Warning | ≥0.85 | <0.85 |
| Benign | ≥0.90 | 0.80-0.89 |

## 🚀 Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start server
python app.py

# 3. Server runs at http://localhost:5000
```

## 📡 API Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "Lung Diagnosis API",
  "version": "3.1.0",
  "rule_system": "Threshold-based Priority (Fixed)",
  "model_loaded": true,
  "supported_diseases": 14
}
```

### Get Diagnosis Rules

```
GET /api/v1/rules
```

Trả về danh sách đầy đủ các bệnh với ngưỡng và khuyến nghị.

---

### Analyze Detections (Manual Input)

```bash
POST /api/v1/analyze
Content-Type: application/json
```

**Request:**
```json
{
  "detections": [
    {"label": "Pneumothorax", "conf": 0.85, "bbox": {"x1": 100, "y1": 200, "x2": 300, "y2": 400}},
    {"label": "Infiltration", "conf": 0.78}
  ]
}
```

---

### Predict from Image

```bash
POST /api/v1/predict
Content-Type: multipart/form-data
```

**Form Data:** `image: <file>`

---

### Predict with Annotated Image

```bash
POST /api/v1/predict-with-image
Content-Type: multipart/form-data
```

**Form Data:** `image: <file>`

Trả về kết quả chẩn đoán + ảnh đã đánh dấu (Base64).

---

### Test Detections

```bash
POST /api/v1/test-detections
Content-Type: application/json

{
  "test_case": "pneumothorax_critical"
}
```

**Test cases có sẵn:** `pneumothorax_critical`, `multiple_findings`, `gray_zone`, `no_findings`

---

## 📋 Response Format

### Khi phát hiện bất thường (DETECTED)

```json
{
  "success": true,
  "file_id": "abc-123-xyz",
  "data": {
    "diagnosis_status": "DETECTED",
    "primary_diagnosis": {
      "label": "Pneumothorax",
      "name_vn": "Tràn khí màng phổi",
      "risk_level": "Critical",
      "confidence_level": "High",
      "recommendation": "ĐI CẤP CỨU NGAY để đánh giá & xử trí. Không trì hoãn.",
      "color": "#DC0000",
      "probability": 0.85
    },
    "findings": [
      {
        "label": "Pneumothorax",
        "name_vn": "Tràn khí màng phổi",
        "probability": 0.85,
        "risk_level": "Critical",
        "confidence_level": "High",
        "recommendation": "ĐI CẤP CỨU NGAY để đánh giá & xử trí. Không trì hoãn.",
        "bbox": {"x1": 100, "y1": 100, "x2": 200, "y2": 200}
      }
    ],
    "gray_zone_notes": [],
    "total_findings": 1
  }
}
```

### Khi không rõ ràng (UNCERTAIN)

```json
{
  "success": true,
  "data": {
    "diagnosis_status": "UNCERTAIN",
    "primary_diagnosis": {
      "label": "Uncertain",
      "name_vn": "Không rõ ràng / Chưa phát hiện bất thường rõ rệt",
      "risk_level": "Uncertain",
      "recommendation": "Nghi ngờ Tràn khí màng phổi (55.0%) nhưng chưa đạt ngưỡng...",
      "color": "#808080"
    },
    "findings": [],
    "gray_zone_notes": [
      {"label": "Pneumothorax", "name_vn": "Tràn khí màng phổi", "probability": 0.55, "required_threshold": 0.60}
    ],
    "total_findings": 0
  }
}
```

## ⚙️ Threshold & Priority Rules

### Priority Rule (Thứ tự ưu tiên)

1. **Nhóm nguy cơ:** Critical → High Risk → Warning → Benign
2. **Trong cùng nhóm:** Theo thứ tự ưu tiên nội bộ (priority_rank)
3. **Cùng ưu tiên:** Chọn xác suất cao nhất

### Gray Zone (Vùng xám)

- Xác suất từ **0.50** đến **dưới ngưỡng** → Ghi nhận vào `gray_zone_notes`
- Nếu không có nhãn nào đạt ngưỡng → Trả về `UNCERTAIN`

## 🐳 Docker

```bash
docker build -t lung-analyzer .
docker run -p 5000:5000 -v ./model:/app/model lung-analyzer
```

## 📁 Project Structure

```
lung_analyzer/
├── app.py              # Flask API v3.1.0
├── model/
│   └── train/
│       └── weights/
│           └── best.pt  # YOLO11 weights
├── uploads/            # Uploaded images
├── outputs/            # Processed outputs
├── requirements.txt
├── Dockerfile
└── README.md
```

## ⚠️ Disclaimer

> **Lưu ý an toàn:** Hệ thống chỉ hỗ trợ sàng lọc, **KHÔNG** thay thế chẩn đoán của bác sĩ. Luôn kết hợp với lâm sàng và ý kiến chuyên khoa.
