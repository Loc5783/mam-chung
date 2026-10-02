# Mầm Chung 🌱

Ứng dụng quản lý tài chính, công việc và tập luyện cho cá nhân/cặp đôi theo master prompt. **Đã hoàn thành giai đoạn 0 và 1: nền tảng + tài khoản/xác thực.** Các nghiệp vụ tài chính, couple, todo và fitness chưa được triển khai. Bản này chưa đủ điều kiện production toàn diện.

## Chạy ngay trên máy (không cần Docker)

Yêu cầu Node.js 20 trở lên và npm.

```powershell
npm ci
npm run dev:local
```

Mở **http://127.0.0.1:5173/register** để tạo tài khoản thật trong bản local. Swagger tại http://127.0.0.1:4000/api/docs.

Lần đầu tải MongoDB 7.0.14 từ nguồn chính thức (Windows khoảng 592 MB). Replica set riêng chỉ lắng nghe loopback. Dữ liệu local lưu trong `.local/data`; khóa JWT được tạo ngẫu nhiên trong `.local/jwt-secret`. Cả hai được loại khỏi Git và Docker build context. `Ctrl+C` dừng toàn bộ hệ thống và giữ dữ liệu. Khi sửa backend, khởi động lại `dev:local`. Các cổng dùng: web 5173, API 4000, MongoDB local 27118; hãy dừng bản chạy cũ trước khi mở bản mới. Thử nghiệm Jest dùng DB riêng, không xóa DB local này.

`.local` là chế độ phát triển trên máy riêng, không phải cấu hình triển khai server. Có thể đặt `MONGOMS_DOWNLOAD_DIR` để tái sử dụng thư mục chứa binary MongoDB đã tải.

## Chức năng hiện có

- Đăng ký, đăng nhập, đăng xuất thật.
- JWT access 15 phút; refresh cookie httpOnly 7 ngày, SameSite=Strict và Secure trong production.
- Refresh rotation; phát hiện reuse thu hồi toàn bộ phiên của tài khoản.
- Khóa 15 phút sau 5 lần sai; login/register giới hạn 10 lần/phút/IP và API 100 lần/phút/IP.
- Hồ sơ: tên, URL ảnh đại diện HTTPS, múi giờ IANA.
- Đổi mật khẩu với mật khẩu hiện tại, thu hồi mọi phiên.
- Xóa tài khoản với xác nhận mật khẩu, soft delete và thu hồi mọi phiên.
- Route guard, tự làm mới token khi 401, khôi phục phiên khi tải lại, Web Locks phối hợp refresh giữa tab trên trình duyệt hỗ trợ.
- Trang `/preview` dùng dữ liệu minh họa được ghi nhãn; trang `/` sau đăng nhập không hiển thị số dư mẫu như dữ liệu thật.

## Chạy qua Docker

Yêu cầu Docker Compose 2.24.4 trở lên.

```powershell
Copy-Item .env.example .env
# Thay JWT_SECRET bằng chuỗi ngẫu nhiên mạnh (tối thiểu 32 ký tự).
docker compose up --build
```

Web http://localhost:8080; API/Swagger http://localhost:4000/api/docs. MongoDB dùng replica set rs0. Bản Docker chưa được chạy trên máy hiện tại vì máy chưa cài Docker.

## Chạy API riêng

Sao chép `.env.example` thành `apps/api/.env` và đặt secret. Chạy MongoDB replica set, sau đó:

```powershell
npm run dev:api
npm run dev:web
```

Giữ URL web và CORS_ORIGIN đồng nhất: mặc định http://127.0.0.1:5173. MongoDB URI ngoài Docker dùng `directConnection=true` vì thành viên replica set trong Docker mang tên `mongo`.

## Kiểm tra

```powershell
npm run lint
npm test
npm run build
npm run format:check
```

Backend Jest/Supertest chạy MongoDB replica set riêng, yêu cầu tải binary lần đầu. Coverage service tự thu thập và bắt buộc statements/functions/lines ≥80%. Frontend dùng Vitest/Testing Library để kiểm tra các form, guard và interceptor.

## HTTPS và proxy (giai đoạn 11)

Cấu hình Caddy được chuẩn bị sẵn. Đặt DOMAIN và secret trong `.env`, DNS trỏ tới máy chủ, mở cổng 80/443:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

CORS_ORIGIN production phải là domain HTTPS thật. TRUST_PROXY_HOPS=0 khi API chạy trực tiếp, 1 khi sau nginx trong Docker dev, 2 khi sau Caddy và nginx production. Không mở API trực tiếp ra Internet với cấu hình tin proxy này. Cần kiểm thử triển khai, bảo vệ MongoDB, backup và hoàn thiện nghiệp vụ trước khi sử dụng production.

## Cấu trúc và tài liệu

- `apps/web`: React 18/Vite/TypeScript, Router, Query, Zustand, Tailwind, giao diện tiếng Việt.
- `apps/api`: Express/Mongoose; route → controller → service → repository; Zod, auth, lỗi thống nhất.
- `docs/MASTER_PROMPT.md`: yêu cầu nguồn.
- `docs/DECISIONS.md`: quyết định triển khai.
- `docs/PHASE_0.md`, `docs/PHASE_1.md`: báo cáo từng giai đoạn.
- `docs/API.md`: API và quy ước. OpenAPI thực tế ở `/api/openapi.json`.
- `.github/workflows/ci.yml`: lint/test/build/format; chưa chạy trên GitHub vì chưa có remote.

Tiếp theo: **Giai đoạn 2 — tài chính cá nhân** (ví, danh mục, giao dịch, chuyển tiền, đối soát và kiểm thử số dư).
