# du-tu-pulmo_ai

## Tổng quan
Dịch vụ AI chẩn đoán X-quang phổi chạy dạng API Flask. Hệ thống sử dụng mô hình YOLO (theo cấu hình trong mã nguồn) kết hợp bộ quy tắc ưu tiên/ngưỡng để trả về chẩn đoán, mức độ nguy cơ và khuyến nghị. Mã nguồn chính nằm trong thư mục `lung_analyzer/`.

## Công nghệ sử dụng
- Python, Flask, Flask-CORS, Flasgger (Swagger UI)
- Ultralytics YOLO
- Xử lý ảnh: OpenCV, Pillow, scikit-image, numpy, pydicom
- Lưu trữ ảnh tùy chọn: Cloudinary

## Yêu cầu hệ thống
- Python 3.x và pip
- (Tùy chọn) GPU nếu dùng PyTorch cho tăng tốc

## Cài đặt và thiết lập
```bash
cd lung_analyzer
pip install -r requirements.txt
```

Khuyến nghị:
- Tạo môi trường ảo trước khi cài đặt.
- Sao chép `.env.example` thành `.env` và điền cấu hình.

## Biến môi trường
Tạo file `.env` trong `lung_analyzer/` (tham khảo `.env.example`):
- `FLASK_ENV`: môi trường chạy (`development`/`production`)
- `FLASK_DEBUG`: bật/tắt debug (`true`/`false`)
- `PORT`: cổng chạy API (mặc định `5000`)
- `MODEL_PATH`: đường dẫn weights (mặc định `model/train/weights/best.pt`)
- `CONF_THRESHOLD`: ngưỡng confidence khi suy luận
- `IMAGE_TARGET_SIZE`: kích thước ảnh đầu vào cho tiền xử lý
- `APPLY_HISTOGRAM_EQ`: bật cân bằng histogram (`true`/`false`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`: cấu hình Cloudinary (bắt buộc nếu dùng API v1)
- `INTERNAL_API_KEY`: khóa nội bộ cho API v2 (header `X-API-Key`)

Lưu ý: Không commit giá trị bí mật vào git.

## Chạy ứng dụng
```bash
cd lung_analyzer
python app.py
```
Mặc định chạy tại `http://localhost:5000` (có thể đổi bằng `PORT`).

## Tài liệu API (cho BE)
Không áp dụng cho repo AI, tuy nhiên có Swagger UI để tra cứu:
- Swagger UI: `http://localhost:5000/docs`
- Swagger spec JSON: `http://localhost:5000/apispec.json`

Các endpoint chính:
- `GET /health`: kiểm tra trạng thái dịch vụ
- `GET /api/v1/rules`: danh sách luật chẩn đoán và ngưỡng
- `POST /api/v1/predict`: upload ảnh (multipart) và trả về kết quả + URL ảnh (Cloudinary)
- `POST /api/v2/predict`: nhận `image_url` (JSON) và trả về kết quả (yêu cầu `X-API-Key`)

## Kiểm thử
Chưa có bộ test tự động trong repo.

## Triển khai
Repo có sẵn `lung_analyzer/Dockerfile`.
Ví dụ chạy nhanh:
```bash
docker build -t lung-analyzer .
docker run -p 5000:5000 -v ./model:/app/model lung-analyzer
```
Đảm bảo:
- `MODEL_PATH` trỏ đúng weights
- Cloudinary được cấu hình nếu dùng v1

## Cấu trúc dự án
Xem chi tiết tại `docs/structure.md`.

## Đóng góp
- Tạo nhánh mới từ nhánh chính.
- Mô tả rõ mục tiêu thay đổi và cách kiểm thử.
