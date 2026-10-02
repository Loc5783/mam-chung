# Mầm Chung 🌱

Ứng dụng tài chính, công việc và tập luyện cho cá nhân/cặp đôi theo master prompt. **Hiện hoàn thành nền tảng giai đoạn 0, chưa phải ứng dụng production đầy đủ.**

## Yêu cầu

Node.js 20 trở lên; npm; Docker Compose 2.24.4 trở lên để chạy stack và hỗ trợ override production.

## Chạy giao diện mẫu

```powershell
npm ci
npm run dev:web
```

Mở http://localhost:5173. Tổng quan hiển thị dữ liệu mẫu. /login và /register chỉ kiểm tra biểu mẫu, chưa tạo tài khoản thật.

## Chạy cả hệ thống

```powershell
Copy-Item .env.example .env
# Thay JWT_SECRET bằng chuỗi ngẫu nhiên mạnh tối thiểu 32 ký tự.
docker compose up --build
```

Web: http://localhost:8080. Swagger: http://localhost:4000/api/docs. Mongo được khởi tạo replica set rs0 và giữ dữ liệu trong volume.

## API ngoài Docker

Khởi động Mongo qua `docker compose up -d mongo mongo-init`. Sao chép `.env.example` thành `apps/api/.env`, đặt secret, sau đó `npm run dev:api`. URI localhost dùng directConnection cho replica set một node.

## Kiểm tra

```powershell
npm run lint
npm test
npm run build
npm run format:check
```

## Cấu trúc

apps/web: React 18, Vite, TypeScript, Router, Query, Zustand, Tailwind và giao diện responsive tiếng Việt.
apps/api: Express, TypeScript, Mongoose, cấu hình Zod, helmet/CORS/rate limit, xử lý lỗi và Swagger.
docs: quyết định và API. .github/workflows: lint/test/build/format trong CI.

## HTTPS (chuẩn bị cho giai đoạn 11)

Đặt DOMAIN và secret trong .env, trỏ DNS đến máy chủ, mở cổng 80/443 và chạy:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Caddy cấp HTTPS. Chưa có xác thực/nghiệp vụ, không dùng bản này lưu dữ liệu thật. Backup, hardening và kiểm thử triển khai nằm ở giai đoạn 11.

## Tiếp theo

Giai đoạn 1: đăng ký, đăng nhập, JWT 15 phút, refresh cookie 7 ngày/rotation, profile, đổi mật khẩu, xóa tài khoản, kiểm thử bảo mật và phân quyền.
