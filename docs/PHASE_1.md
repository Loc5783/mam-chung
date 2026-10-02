# Báo cáo giai đoạn 1 — Auth & User

## Đã hoàn thành

- Đăng ký/đăng nhập/đăng xuất thật, email chuẩn hóa, bcrypt cost 12.
- JWT 15 phút, refresh cookie 7 ngày, hash trong DB, rotation, phát hiện reuse và thu hồi mọi phiên.
- Khóa tài khoản 15 phút sau 5 lần sai, rate limit 10 lần/phút/IP cho login/register.
- Middleware lấy userId/coupleId từ DB, kiểm tra trạng thái phiên và securityVersion.
- Hồ sơ tên/avatar HTTPS/múi giờ IANA; đổi mật khẩu và xóa tài khoản có xác nhận mật khẩu, thu hồi phiên cũ.
- Frontend route guard, interceptor tự refresh, phối hợp các request đồng thời và các tab có Web Locks, khôi phục phiên khi tải lại.
- Trang /settings hoạt động. Dữ liệu minh họa nằm riêng ở /preview; tổng quan thật không hiển thị tiền mẫu.
- Swagger/OpenAPI đầy đủ các endpoint giai đoạn 1; hướng dẫn chạy local không cần Docker.

## Kiểm tra thực tế

- Backend: **28/28 test đạt**, chạy trên MongoDB 7.0.14 replica set, bao gồm concurrent register/refresh, rollback, logout-refresh race và phân quyền.
- Frontend: **20/20 test đạt**, gồm các form, route guard, refresh interceptor, single-flight và xử lý request trả chậm.
- Coverage service: **94,91% statements**, **86,36% branches**, **100% functions**, **95,68% lines**; mỗi service đều vượt 80%.
- Lint/TypeScript: đạt.
- Build API/web: đạt.
- Kiểm tra trình duyệt với tài khoản test riêng: đăng nhập, tải lại giữ phiên, cập nhật tên hồ sơ và đăng xuất đều hoạt động. Tài khoản QA đã được vô hiệu hóa sau kiểm thử.
- Màn hình đăng ký ở viewport 390×844 vừa màn hình, không tràn ngang.
- Docker/HTTPS trên domain và GitHub CI chưa được chạy thực tế; chưa có Docker/domain/remote.

## Cách chạy

```powershell
npm ci
npm run dev:local
```

Web: http://127.0.0.1:5173/register. API Swagger: http://127.0.0.1:4000/api/docs.

Dữ liệu local giữ trong .local/data, secret riêng trong .local/jwt-secret, đều bị loại khỏi Git/Docker. Không dùng bản chạy local như cấu hình production.

```powershell
npm run lint
npm test
npm run build
npm run format:check
```

## Quyết định

Chi tiết ở docs/DECISIONS.md. Soft delete tài khoản, chưa có tự khôi phục; đang thuộc couple thì phải rời/giải tán trước. Avatar là URL HTTPS. Các chức năng tài chính/couple/todo/fitness chưa triển khai.

## Tiếp theo

**Giai đoạn 2 — tài chính cá nhân:** ví, danh mục, giao dịch, chuyển tiền, đối soát, lọc/tìm, dashboard và kiểm thử số dư. Dừng sau giai đoạn 1 theo mục 17 của master prompt, chờ xác nhận của người dùng.

## Tệp mới/sửa

- .dockerignore
- .env.example
- .gitignore
- apps/api/jest.config.cjs
- apps/api/src/app.ts
- apps/api/src/config/db.ts
- apps/api/src/config/env.ts
- apps/api/src/config/openapi.ts
- apps/api/src/middlewares/auth.ts
- apps/api/src/middlewares/errorHandler.ts
- apps/api/src/middlewares/validate.ts
- apps/api/src/modules/auth/controller.ts
- apps/api/src/modules/auth/model.ts
- apps/api/src/modules/auth/repository.ts
- apps/api/src/modules/auth/routes.ts
- apps/api/src/modules/auth/schema.ts
- apps/api/src/modules/auth/service.ts
- apps/api/src/modules/auth/tests/auth.test.ts
- apps/api/src/modules/users/controller.ts
- apps/api/src/modules/users/model.ts
- apps/api/src/modules/users/repository.ts
- apps/api/src/modules/users/routes.ts
- apps/api/src/modules/users/schema.ts
- apps/api/src/modules/users/service.ts
- apps/api/src/utils/asyncHandler.ts
- apps/api/src/utils/transaction.ts
- apps/web/nginx.conf
- apps/web/src/app/App.tsx
- apps/web/src/components/ui/Avatar.tsx
- apps/web/src/components/ui/Modal.tsx
- apps/web/src/features/auth/AuthGate.tsx
- apps/web/src/features/auth/AuthPage.tsx
- apps/web/src/features/auth/store.ts
- apps/web/src/features/dashboard/AccountHome.tsx
- apps/web/src/features/settings/SettingsPage.tsx
- apps/web/src/lib/apiClient.ts
- apps/web/src/styles/global.css
- apps/web/src/test/apiClient.test.ts
- apps/web/src/test/app.test.tsx
- docker-compose.prod.yml
- docker-compose.yml
- docs/API.md
- docs/DECISIONS.md
- package.json
- README.md
- scripts/dev-local.cjs
- docs/PHASE_1.md
