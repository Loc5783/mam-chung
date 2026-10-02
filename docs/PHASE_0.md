# Báo cáo giai đoạn 0

## Đã làm

Monorepo React 18/Vite/TypeScript và Express/Mongoose; theme đúng token xanh cốm/hồng; layout sidebar và bottom nav; tổng quan dữ liệu minh họa; login/register mẫu với validation tiếng Việt; Docker Compose replica set một node; cấu hình Caddy HTTPS; CI; Swagger health; hướng dẫn và quyết định.

## Kiểm tra thực tế

- Lint/TypeScript: đạt.
- Backend: 4/4 test đạt.
- Frontend: 3/3 test đạt.
- Build API và web: đạt.
- Prettier: đạt.
- Đã mở và kiểm tra giao diện tổng quan trong trình duyệt.
- Chưa chạy Docker vì máy không có Docker. Chưa kiểm chứng replica set hoặc HTTPS thực tế.
- CI đã cấu hình, chưa chạy trên GitHub.

## Cách chạy

```powershell
npm ci
npm run dev:web
npm run lint
npm test
npm run build
```

Web tại http://127.0.0.1:5173. Chạy cả stack và môi trường được mô tả trong README.md.

## Quyết định

Xem docs/DECISIONS.md. Không coi dữ liệu mẫu là dữ liệu tài khoản thật; chưa triển khai xác thực hoặc nghiệp vụ. Chưa đủ điều kiện production.

## Tiếp theo

Giai đoạn 1: Auth & User. Dừng sau giai đoạn 0 theo mục 17 của master prompt, chờ người dùng xác nhận.

## Tệp đã tạo

- apps/api/Dockerfile
- apps/api/eslint.config.mjs
- apps/api/jest.config.cjs
- apps/api/package.json
- apps/api/tsconfig.json
- apps/api/src/app.ts
- apps/api/src/server.ts
- apps/api/src/config/db.ts
- apps/api/src/config/env.ts
- apps/api/src/config/logger.ts
- apps/api/src/middlewares/errorHandler.ts
- apps/api/src/modules/.gitkeep
- apps/api/src/seeds/.gitkeep
- apps/api/src/tests/app.test.ts
- apps/api/src/utils/AppError.ts
- apps/api/src/utils/money.ts
- apps/web/Dockerfile
- apps/web/eslint.config.js
- apps/web/index.html
- apps/web/nginx.conf
- apps/web/package.json
- apps/web/postcss.config.js
- apps/web/tailwind.config.js
- apps/web/tsconfig.json
- apps/web/vite.config.ts
- apps/web/public/favicon.svg
- apps/web/public/manifest.webmanifest
- apps/web/src/main.tsx
- apps/web/src/app/App.tsx
- apps/web/src/app/store.ts
- apps/web/src/components/ui/index.tsx
- apps/web/src/features/auth/AuthPage.tsx
- apps/web/src/features/budgets/.gitkeep
- apps/web/src/features/categories/.gitkeep
- apps/web/src/features/couple/.gitkeep
- apps/web/src/features/dashboard/Dashboard.tsx
- apps/web/src/features/fitness/.gitkeep
- apps/web/src/features/goals/.gitkeep
- apps/web/src/features/notifications/.gitkeep
- apps/web/src/features/settings/.gitkeep
- apps/web/src/features/shared-finance/.gitkeep
- apps/web/src/features/tasks/.gitkeep
- apps/web/src/features/transactions/.gitkeep
- apps/web/src/features/wallets/.gitkeep
- apps/web/src/lib/apiClient.ts
- apps/web/src/lib/format.ts
- apps/web/src/lib/queryClient.ts
- apps/web/src/styles/global.css
- apps/web/src/test/app.test.tsx
- apps/web/src/test/setup.ts
- docs/API.md
- docs/DECISIONS.md
- docs/MASTER_PROMPT.md
- .github/workflows/ci.yml
- package.json
- package-lock.json
- .env.example
- .gitignore
- .dockerignore
- .prettierignore
- docker-compose.yml
- docker-compose.prod.yml
- Caddyfile
- README.md
