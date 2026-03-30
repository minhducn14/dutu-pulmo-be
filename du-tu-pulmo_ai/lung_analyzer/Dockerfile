FROM python:3.11-slim

# Cài đặt các thư viện hệ thống cần thiết cho OpenCV
# Đã sửa: dùng libgl1 thay cho gói cũ libgl1-mesa-glx
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# BƯỚC QUAN TRỌNG NHẤT: Cài Torch bản CPU trước
# Việc này giúp 'chặn' Ultralytics tự tải bản GPU (nặng vài GB) sau này
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Cài các gói còn lại từ requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Giảm số lượng workers xuống 2 để tránh app bị crash lúc đang chạy (Runtime OOM)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]