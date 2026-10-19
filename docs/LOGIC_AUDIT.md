# Rà soát logic ngày 03/10/2026

Phạm vi: các chức năng đã triển khai ở giai đoạn 1–4. Không bao gồm tính năng tương lai hoặc kiểm chứng production.

Các lỗi đã sửa:

- Chuẩn hóa ObjectId về chữ thường trước khi so sánh: chặn chuyển cùng ví, thay danh mục bằng chính nó và chuyển quyền owner cho chính mình; gom đúng delta khi sửa giao dịch.
- Tìm kiếm cả mô tả, ghi chú và nhãn, dùng cùng bộ lọc cho tổng và CSV; giữ điều kiện chủ sở hữu và escape regex.
- Gắn yêu cầu HTTP với phiên ban đầu; từ chối phản hồi cũ, không retry giao dịch dưới tài khoản khác, không dùng chung refresh của hai phiên. Refresh mất mạng giữ phiên để thử lại.
- Kết quả ghi Couple thành công không phụ thuộc việc tải lại hồ sơ; mã mời vẫn hiện khi bước tải hồ sơ thất bại.
- Cho sửa mẫu định kỳ đã kết thúc khi đang tắt; bật lại cần gia hạn. Giữ anchor ngày 31 nếu form gửi lại ngày 28 mà không thay ngày kỳ tiếp theo.
- Sửa chuyển đổi múi giờ ở ngày đổi giờ tại nửa đêm, năm trước 100; từ chối ngày bị loại khỏi lịch địa phương thay vì đổi sang ngày khác.
- Đăng nhập sai trả chậm không cộng lỗi vào phiên mật khẩu đã thay đổi. Đổi timezone làm mới cả dữ liệu Couple.

Xác minh: 135/135 kiểm thử API và 71/71 kiểm thử web đạt; lint và build đạt. Coverage service: 98.21% statements, 90.27% branches, 100% functions, 98.99% lines. API local bằng tài khoản QA riêng đã kiểm tra sửa/đảo giao dịch, đối soát hai ví, tìm kiếm/CSV, ngân sách, góp/hoàn tác tiết kiệm, lịch kết thúc, chặn self-transfer-owner và báo cáo. Dữ liệu demo được giữ nguyên.

---

# Rà soát & Tăng cường bảo mật ngày 13–14/10/2026 (Chốt hạ trước khi Go-Live)

Phạm vi: Bảo mật repo công khai, quy trình đặt lại mật khẩu admin, bảo vệ HTTP headers / thu hẹp bề mặt tấn công, nâng cấp bcrypt 6, xử lý xung đột đồng thời 409 To-do và chuẩn bị quy trình Go-Live.

Các nội dung đã thực hiện & vá lỗi:

1. **Vệ sinh Repo Public:**
   - Quét toàn bộ lịch sử Git bằng regex patterns và gitleaks/trufflehog checks, khẳng định 0 bí mật/private key/token bị commit.
   - Thắt chặt `.gitignore` và `.dockerignore` bảo vệ `.env*`, keyfile Mongo, `.local`, backups.
   - Kiểm tra workflows CI: quyền tối thiểu, không in secrets, ghim phiên bản.

2. **Đặt lại mật khẩu khẩn cấp (Admin CLI):**
   - Viết script `apps/api/src/scripts/admin-reset-password.ts` chạy trực tiếp trong container production hoặc qua `npm run admin:reset-password`.
   - Sinh mật khẩu ngẫu nhiên an toàn bằng CSPRNG (≥ 16 ký tự), băm bằng bcrypt cost 12.
   - Thu hồi toàn bộ refresh token / session family của tài khoản và mở khóa nếu đang bị rate-limit.
   - In mật khẩu tạm ra stdout một lần duy nhất, không ghi vào logger hay file.

3. **Thu hẹp bề mặt lộ thông tin & Header bảo mật:**
   - Cấu hình CSP nghiêm ngặt cho Caddyfile & nginx: `script-src 'self'` (không có `unsafe-inline`), font/style whitelist rõ ràng, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`.
   - Tắt Swagger OpenAPI UI ở production (mặc định trả 404, chỉ mở khi có biến `ENABLE_API_DOCS=true`).
   - Rút gọn endpoint `/api/health` ở production: chỉ trả `{ "status": "ok" }`, ẩn toàn bộ phase, phiên bản và thông tin nội bộ.
   - Vá lỗ hổng open-redirect trong `AuthPage.tsx`: chặn bypass bằng dấu backslash `\`.
   - Viết script kiểm tra tự động `scripts/check-security-headers.cjs` và bộ test `scripts/tests/security-headers.test.cjs`.

4. **Nâng cấp bcrypt & Quản lý phụ thuộc:**
   - Nâng cấp `bcrypt` lên `^6.0.0` và `@types/bcrypt` lên `^6.0.0`.
   - Bổ sung test kiểm chứng tương thích ngược: đảm bảo các hash cũ được tạo từ bcrypt v5 (`$2b$12$...`) vẫn xác thực thành công 100% với bcrypt v6.
   - Cấu hình `.github/dependabot.yml` quét định kỳ hàng tuần cho npm, github-actions và docker.

5. **Xử lý xung đột đồng thời (409 OCC) & Test Flaky trong To-do:**
   - Tìm nguyên nhân gốc gây flaky test 409 trong `apps/web/src/test/user-errors-b2.test.tsx` (thiếu mock mặc định GET activity khiến Axios gọi mạng thật trong JSDOM và race condition timer autosave). Khắc phục triệt để, chạy 5 lần liên tiếp đạt 13/13 test.
   - Nâng cấp UX trong `TaskDetailDrawer.tsx`: khi phát hiện xung đột phiên bản (409), hiển thị banner ấm áp với 2 hành động cụ thể: (1) "Xem bản mới" (tải lại dữ liệu mới nhất từ server, hủy nháp) và (2) "Giữ bản của tôi" (lấy revision mới nhất từ server và ghi đè nội dung draft lên).
   - Bổ sung thông báo lỗi qua `useUiStore.getState().notify` thay vì nuốt lỗi âm thầm trong các khối catch khi gọi API.

Xác minh:

- `npm run lint`: 0 lỗi, 0 cảnh báo.
- `npm test -w @mam-chung/web`: 26/26 files, 325/325 tests đạt.
- `npm test -w @mam-chung/api`: 15/15 test suites, 321/321 tests đạt (Coverage statements: 98.39%, lines: 99.06%).
- `npm run build`: Biên dịch TypeScript và đóng gói Vite thành công không lỗi.
- `npm run test:ops` & `npm run check:headers`: 12/12 ops tests đạt.

---

# Rà soát & Kiểm toán an toàn Trang Quản trị (Admin Panel) ngày 19/10/2026

Phạm vi: Toàn bộ module Quản trị viên (`apps/api/src/modules/admin`, middleware `requireAdmin`, scripts CLI, giao diện web `apps/web/src/features/admin`).

Các nội dung đã thực hiện & nguyên tắc bảo mật tối thượng:

1. **Cách ly dữ liệu người dùng ở cấp kiến trúc & Lint:**
   - Cấu hình ESLint `no-restricted-imports` nghiêm cấm toàn bộ file trong `apps/api/src/modules/admin/**` import model/service của: `finance, shared, tasks, fitness, planning, dashboard`.
   - Bổ sung test tự động `isolation.test.ts` quét AST mã nguồn đảm bảo quy tắc cách ly không bị phá vỡ. Quản trị viên tuyệt đối không có đường dẫn tới dữ liệu nội dung riêng tư của người dùng.

2. **Allowlist DTO tường minh cho mọi phản hồi API:**
   - Tất cả các endpoint đọc (`/overview`, `/users`, `/couples`, `/audit`) trả về đối tượng DTO với danh sách trường cho phép rõ ràng.
   - Tuyệt đối không bao giờ trả về `passwordHash`, `refreshToken`, `tokenHash`, hay hash mã mời.
   - Bộ test tự động `read-api.test.ts` duyệt quét toàn bộ khóa JSON của các phản hồi admin để đối chiếu danh sách cho phép.

3. **Cổng chặn phân quyền & Xác thực Step-up:**
   - Trường `User.role` ("user" | "admin") không thể bị thay đổi qua body của bất kỳ route công khai nào (toàn bộ schema Zod cập nhật hồ sơ/đăng ký là `.strict()`).
   - Middleware `requireAdmin` đọc trực tiếp `role` từ database mỗi request (không tin cậy claim trong JWT) và từ chối nếu tài khoản bị khóa (`disabledAt`) hoặc xóa mềm (`deletedAt`).
   - Mọi thao tác ghi nhạy cảm bắt buộc truyền `adminPassword` để kiểm tra bằng bcrypt với mật khẩu của chính admin đang thao tác (`verifyAdminPassword`). Nhập sai sẽ bị tăng bộ đếm lỗi và khóa theo cấp số nhân để phòng chống tấn công brute-force.

4. **Xóa mềm an toàn (Phương án A):**
   - Khi xóa tài khoản người dùng: email và tên được ẩn danh hóa thành `deleted-<id>-<timestamp>@deleted.local` và `Người dùng cũ`, đặt `deletedAt = new Date()`, thu hồi toàn bộ token.
   - Xử lý rời không gian chung an toàn: tự động chuyển quyền chủ không gian nếu còn thành viên, hoặc lưu trữ cặp nếu là thành viên cuối; toàn vẹn lịch sử giao dịch và sổ cái tài chính.
   - Chặn xóa hoặc gỡ quyền nếu là quản trị viên cuối cùng của hệ thống.

5. **Nhật ký Quản trị (Audit Log) & Rate Limiting riêng biệt:**
   - Mọi hành vi nhạy cảm đều được ghi nhận vào collection `admin_audit_logs` (thời gian, IP, admin email, loại hành vi, tóm tắt tham số).
   - Rate limit riêng cho `/api/admin/*` ở mức 60 requests/phút/IP (`adminLimiter`).

6. **Giao diện Web & Cách ly DOM:**
   - Route `/admin/*` được chia chunk độc lập, bọc trong `AuthGate` và guard chuyển hướng người dùng thường về `/`.
   - Sidebar chỉ hiển thị mục Quản trị cho tài khoản `role: "admin"`.
   - Thiết kế responsive thân thiện: hiển thị dạng bảng trên màn hình lớn và chuyển sang danh sách thẻ dọc trên màn hình di động hẹp (375px), không gây tràn ngang.
   - Thẻ cặp đôi trong tab Không gian chung chỉ hiển thị thành viên và số mã mời. Bộ test `admin.test.tsx` thực hiện quét DOM xác nhận không có bất kỳ từ khóa nào liên quan đến tiền, ví, nhiệm vụ, số đo hay cân nặng.
   - Khi cổng đăng ký đóng (`registrationOpen: false`), trang đăng ký hiển thị thông báo dịu dàng và khóa form; backend từ chối đăng ký mới với mã `403 REGISTRATION_CLOSED`.
