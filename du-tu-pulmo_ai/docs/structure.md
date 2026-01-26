# Chỉ mục cấu trúc dự án
> Tự động tạo ngày 2026-01-24. Dùng để tra cứu nhanh vị trí file/thư mục.

## Thống kê nhanh
- Ngôn ngữ chính: Python
- Điểm vào chính: `lung_analyzer/app.py`

## Cây thư mục (rút gọn)
```
du-tu-pulmo_ai/
├── README.md
├── .gitignore
├── docs/
│   └── structure.md
└── lung_analyzer/
    ├── app.py
    ├── config.py
    ├── requirements.txt
    ├── Dockerfile
    ├── .env.example
    ├── AI_DIAGNOSIS_RULES.md
    ├── PREDICT_API_GUIDE.md
    ├── models/
    ├── routes/
    ├── services/
    ├── model/
    │   ├── train/
    │   ├── train512/
    │   └── train1024/
    ├── outputs/
    └── uploads/
```

## Điểm vào chính
- `lung_analyzer/app.py`: khởi tạo Flask app và các route API.

## Tệp cấu hình
- `lung_analyzer/.env.example`: mẫu biến môi trường
- `lung_analyzer/config.py`: tải cấu hình từ biến môi trường
- `lung_analyzer/requirements.txt`: phụ thuộc Python
- `lung_analyzer/Dockerfile`: đóng gói container

## Bản đồ tính năng
| Tính năng | Vị trí | Tệp chính |
|---|---|---|
| Dự đoán X-quang | `lung_analyzer/routes/` | `predict.py` |
| Quy tắc chẩn đoán | `lung_analyzer/routes/` | `rules.py` |
| Phân tích chẩn đoán | `lung_analyzer/services/` | `diagnosis_analyzer.py` |
| Xử lý ảnh | `lung_analyzer/services/` | `image_processor.py` |
| Cấu hình nhãn bệnh | `lung_analyzer/models/` | `disease_config.py` |

## Mẫu đường dẫn
- Route API: `lung_analyzer/routes/*.py`
- Service xử lý: `lung_analyzer/services/*.py`
- Weights mô hình: `lung_analyzer/model/**/weights/*.pt`
- Dữ liệu ảnh: `lung_analyzer/uploads/*`

## Ghi chú dữ liệu
- Thư mục `model/` và `uploads/` chứa nhiều tệp dữ liệu lớn (ảnh/weights).
