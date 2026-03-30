FROM python:3.11-slim

# Cài đặt các thư viện hệ thống cần thiết cho OpenCV (rất quan trọng cho bản slim)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bước 1: Cài Torch bản CPU trước để 'chặn' Ultralytics tự tải bản nặng
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Bước 2: Cài các gói còn lại từ requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Hạ workers xuống 2 để tiết kiệm RAM cho server (mỗi worker sẽ load 1 bản model AI)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]