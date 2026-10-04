# Mầm Chung 🌱

Ứng dụng quản lý tài chính, công việc và tập luyện cho cá nhân/cặp đôi theo master prompt. **Đã hoàn thành giai đoạn 0–8: nền tảng, tài khoản, tài chính cá nhân, ngân sách, mục tiêu, định kỳ, báo cáo và CSV.** Couple đã có tạo/mời/ghép đôi, ngày kỷ niệm và lưu trữ. Tài chính chung đã có quỹ, đóng góp, chia tiền, công nợ hai bước và mục tiêu. Công việc cá nhân/chung, Kanban, việc con, lặp lại, bình luận và mua sắm chung đã sẵn sàng. Fitness đã có sổ buổi tập/set, ghi nhanh, mẫu, số đo, mục tiêu tuần và biểu đồ volume/rep/1RM/PR. Dashboard tổng hợp và thông báo trong ứng dụng đã có. Tiếp theo là giai đoạn9: hoàn thiện responsive/PWA, khả năng truy cập và hiệu năng. Bản này chưa đủ điều kiện production toàn diện.

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

- Tài chính tại `/finance`: ví tiền mặt/ngân hàng/điện tử, lưu trữ/khôi phục, đối soát.
- Thu/chi: tạo/sửa/xóa/nhân bản, ghi chú/nhãn, lọc ngày/ví/danh mục/loại, tìm kiếm, sắp xếp và phân trang.
- Chuyển tiền hai ví bằng một transaction, hai dòng liên kết, không tính vào tổng thu/chi.
- Danh mục mặc định và riêng; xóa danh mục riêng có lịch sử cần danh mục thay thế.
- Tổng quan thực: số dư mọi ví, thu/chi theo tháng và múi giờ hồ sơ, so sánh tháng trước, biểu đồ chi và giao dịch gần đây.

- Ngân sách theo danh mục chi và tháng, tiến độ thực theo sổ, nhắc 80%/100%.
- Mục tiêu tiết kiệm: hạn, màu, dành dụm, lịch sử và hoàn tác khoản ghi nhận. Tiền dành dụm là theo dõi riêng, không tự trừ ví.
- Giao dịch tuần/tháng: bật/tạm dừng, ngày kết thúc, chạy bù, thử lại kỳ thiếu tiền; khóa duy nhất để chống ghi trùng.
- Báo cáo 6/12 tháng: cột thu chi, so sánh tháng trước, xu hướng chi theo danh mục và bảng số liệu.
- Xuất CSV theo bộ lọc lịch sử, UTF-8 BOM, tối đa 10.000 dòng/lần; trường văn bản được bảo vệ trước công thức bảng tính.

- Couple tại `/couple`: tạo hành trình, mã/link mời 48 giờ một lần, ghép đôi, chuyển quyền, rời/giải tán; lịch sử lưu trữ chỉ đọc cho cả hai.
- Ngày kỷ niệm, số ngày bên nhau, nhắc trên tổng quan, bảng hoạt động cập nhật mỗi 5 giây khi mở trang.
- Trang `/invite/:code` yêu cầu đăng nhập, xem lời mời trước khi chấp nhận; chỉ chia sẻ tên/ảnh, tài chính cá nhân vẫn riêng tư.

- Tài chính chung tại `/shared`: nhiều quỹ, nạp tiền theo người góp, lịch sử, lưu trữ/khôi phục.
- Khoản chi chung trả từ quỹ hoặc ứng cá nhân; chia đều, số tiền tùy chỉnh hoặc phần trăm, tổng luôn khớp đến một đồng.
- Công nợ tự tạo từ khoản ứng: người nợ báo đã trả, người nhận xác nhận/từ chối; tổng hợp ròng và lịch sử có bộ lọc.
- Mục tiêu chung có đóng góp và hoàn tác; dashboard hiển thị số dư, chi tháng theo danh mục, công nợ và mục tiêu.
- Hành trình đã lưu trữ giữ toàn bộ sổ chung ở chế độ chỉ đọc. Ứng dụng ghi nhận tiền, không chuyển tiền ngân hàng.

- Công việc tại `/tasks`: cá nhân/chung/giao cho tôi; lọc trạng thái, ưu tiên, hạn, nhãn, tìm kiếm và sắp xếp.
- Danh sách và Kanban bốn cột; chọn trạng thái để chuyển việc, ghi thời gian hoàn thành.
- Checklist, lặp ngày/tuần/tháng, bình luận ngắn trên việc chung, danh sách mua sắm tick từng món.
- Cả hai sửa việc chung; revision bảo vệ khi sửa đồng thời. Lịch sử couple cũ chỉ đọc; việc cá nhân vẫn riêng.
- Tổng quan có việc hôm nay, quá hạn và hoàn thành nhanh theo múi giờ hồ sơ.

Chi tiết triển khai và kiểm tra: [Giai đoạn 5](docs/PHASE_5.md), [Giai đoạn 6](docs/PHASE_6.md), [Giai đoạn 7](docs/PHASE_7.md), [Giai đoạn 8](docs/PHASE_8.md).

## Dashboard và thông báo

Trang `/` tổng hợp số dư cá nhân, thu/chi tháng, donut chi tiêu, ngân sách, việc hôm nay/quá hạn với nút Xong, nhịp tập và hành trình chung. Một yêu cầu `/api/dashboard` cấp dữ liệu các khối. Bốn nút nhanh mở ngay biểu mẫu giao dịch, chi chung, công việc hoặc buổi tập.

Chuông trên thanh đầu trang hiển thị thông báo của tài khoản hiện tại: lời mời, công nợ, yêu cầu xác nhận tiền, việc được giao, hạn việc và ngân sách chạm/vượt 100%. Có đọc một/đọc tất cả, chỉ chưa đọc, phân trang và mở đúng mục liên quan. Dashboard/chuông tự làm mới 15 giây khi trang đang mở; không email/SMS/push. Những điều kiện đã xử lý sẽ tự ẩn; không lưu lại sự kiện thoáng qua nếu ứng dụng không đồng bộ khi điều kiện còn hiệu lực. Người nhận lời mời cần xem trước bằng mã hợp lệ trước khi nhận nhắc trong ứng dụng.

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

Backend Jest/Supertest chạy MongoDB replica set riêng, yêu cầu tải binary lần đầu. Coverage service tự thu thập và bắt buộc statements/branches/functions/lines ≥80%. Frontend dùng Vitest/Testing Library để kiểm tra các form, guard và interceptor.

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
- `docs/PHASE_0.md`, `docs/PHASE_1.md`, `docs/PHASE_2.md`, `docs/PHASE_3.md`, `docs/PHASE_4.md`: báo cáo từng giai đoạn.
- `docs/API.md`: API và quy ước. OpenAPI thực tế ở `/api/openapi.json`.
- `.github/workflows/ci.yml`: lint/test/build/format; chưa chạy trên GitHub vì chưa có remote.

Tiếp theo: **Giai đoạn 9 — responsive/PWA, a11y, hiệu năng, seed demo và hoàn thiện Swagger.**
