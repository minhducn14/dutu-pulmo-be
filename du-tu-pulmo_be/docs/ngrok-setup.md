# Ngrok Setup Guide

## 1. Cấu hình Authtoken (một lần)

```bash
# Đăng ký tài khoản tại https://dashboard.ngrok.com
# Lấy authtoken từ dashboard và chạy:
npx ngrok config add-authtoken YOUR_AUTHTOKEN
```

## 2. Chạy Ngrok cho Backend (port 3000)

```bash
npm run tunnel
```

Ngrok sẽ cho bạn URL như: `https://abc123.ngrok-free.app`

## 3. Cấu hình PayOS Webhook

1. Vào [PayOS Dashboard](https://my.payos.vn)
2. Chọn project -> Cài đặt -> Webhook
3. Cập nhật Webhook URL thành: `https://abc123.ngrok-free.app/api/payment/webhook`

## 4. Cập nhật .env

```env
# Thêm ngrok URL vào .env (để frontend redirect đúng)
BACKEND_URL=https://abc123.ngrok-free.app
```

## 5. Tips

- Xem logs: `http://127.0.0.1:4040` (ngrok inspect interface)

## 6. Script nhanh

```bash
# Chạy cả backend và ngrok
# Terminal 1:
npm run start:dev

# Terminal 2:
npm run tunnel
```
