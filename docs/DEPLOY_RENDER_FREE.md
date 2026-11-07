# Deploy Mầm Chung trên Render Free

Chạy giao diện và API trên cùng origin để giữ cookie SameSite=Strict.

- Repository: https://github.com/Loc5783/mam-chung
- Runtime: Node
- Region: Singapore
- Plan: Free (không chọn gói trả phí)
- Build: npm ci --include=dev && npm run build
- Start: node scripts/render-server.cjs
- Health check: /api/health
- NODE_VERSION: 24
- NODE_ENV: production
- TRUST_PROXY_HOPS: 1 (Render trực tiếp; không thêm proxy khác)
- CORS_ORIGIN: địa chỉ HTTPS thực tế của web service, không thêm đường dẫn
- JWT_SECRET: giá trị ngẫu nhiên riêng tối thiểu 32 ký tự
- MONGODB_URI: chuỗi Atlas riêng có database /mam_chung, không commit hoặc gửi chat

Atlas: chỉ cho phép các địa chỉ outbound của service Render qua IP Access List.
Không dùng IP máy cá nhân làm IP cho server Render.

Gói Free có thể ngủ: nhắc việc và tác vụ định kỳ chỉ chạy khi tiến trình hoạt động.
Không coi đây là bộ nhắc việc luôn chạy đúng giờ khi service ngủ.

Không chuyển dữ liệu local/demo vào Atlas tự động.
Bản build local có các thay đổi người dùng chưa commit; phải xác định bản source được phát hành trước khi push/deploy.
