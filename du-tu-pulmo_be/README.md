# du-tu-pulmo_be

## Tổng quan
Backend cho hệ thống khám/chăm sóc sức khỏe từ xa (telehealth). Dự án xây dựng bằng NestJS, cung cấp API REST, xác thực JWT, realtime (Socket.IO) và tài liệu Swagger. Các module chính nằm trong `src/modules/` (account, auth, doctor, patient, appointment, medical, payment, chat, notification, screening, video call...).

## Công nghệ sử dụng
- Node.js, TypeScript, NestJS
- TypeORM, PostgreSQL
- Swagger, JWT, Passport
- Socket.IO
- Tích hợp dịch vụ qua biến môi trường: Cloudinary, VNPay, PayOS, Daily, Google OAuth, Pulmo AI

## Yêu cầu hệ thống
- Node.js và npm
- PostgreSQL

## Cài đặt và thiết lập
```bash
npm install
```

## Biến môi trường
Cấu hình trong `.env` ở root dự án (không commit giá trị thật):
- `NODE_ENV`: môi trường chạy
- `PORT`: cổng backend (mặc định 3000)
- `FRONTEND_URL`: URL FE dùng cho CORS/redirect
- `DB_URL`: chuỗi kết nối PostgreSQL
- `DB_TYPE`: loại DB (ví dụ `postgres`)
- `JWT_SECRET`: khóa ký JWT
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: cấu hình email SMTP
- `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL`, `VNP_RETURN_URL`, `VNP_IPN_URL`: cấu hình VNPay
- `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`: cấu hình PayOS
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: cấu hình Cloudinary
- `DAILY_API_KEY`: cấu hình Daily (video call)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: cấu hình Google OAuth
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FULLNAME`: tài khoản admin mặc định khi seed
- `PULMO_AI_BASE_URL`, `PULMO_AI_API_KEY`: cấu hình gọi dịch vụ AI

Lưu ý: Nếu repo đang chứa `.env` có thông tin thật, nên tách ra môi trường riêng và thay thế bằng giá trị mẫu.

## Chạy ứng dụng
```bash
# Dev
npm run start:dev

# Debug
npm run start:debug

# Build
npm run build

# Production
npm run start:prod
```
Mặc định chạy tại `http://localhost:3000` (có thể đổi bằng `PORT`).

### Luồng chạy/migration/seed (khuyến nghị)
1. Cài đặt dependencies:
   ```bash
   npm install
   ```
2. Cấu hình `.env` (DB_URL, JWT, SMTP, payment, cloud...).
3. Build để sinh `dist/` (TypeORM CLI dùng file trong `dist/`):
   ```bash
   npm run build
   ```
4. Chạy migration:
   ```bash
   npm run migration:run
   ```
5. Seed dữ liệu (nếu cần):
   ```bash
   npm run seed
   ```
6. Khởi chạy ứng dụng:
   ```bash
   npm run start:prod
   ```

### Tạo migration mới
```bash
npm run migration:generate -- -n <ten_migration>
```
Sau đó chạy lại `npm run migration:run`.

## Tài liệu API (cho BE)
- Swagger UI: `http://localhost:3000/api`
- Swagger JSON: `docs/swagger.json` (được sinh khi ứng dụng khởi chạy)
- Quy chuẩn API: `docs/api-standardization.md`

## Kiểm thử
```bash
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
```

## Triển khai
- Build: `npm run build`
- Chạy: `npm run start:prod`
- Chạy migration (nếu có dùng TypeORM):
  - `npm run migration:run`
- Seed dữ liệu (nếu cần):
  - `npm run seed`

## Cấu trúc dự án
Xem chi tiết tại `docs/structure.md`.

## Đóng góp
- Tạo nhánh mới từ nhánh chính.
- Mô tả rõ mục tiêu thay đổi và cách kiểm thử.
