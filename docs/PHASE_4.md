# Báo cáo giai đoạn 4 — Couple và hành trình chung

## 1. Đã làm gì

- Tạo couple active, owner/member, mỗi tài khoản một nhóm active, tối đa hai người.
- Mã mời 8 ký tự ngẫu nhiên, 48 giờ, dùng một lần, link `/invite/:code`; tạo lại/thu hồi; sao chép mã/link để người dùng tự gửi.
- Xem lời mời sau đăng nhập và chấp nhận rõ ràng; nhận mã, membership, user pointer và activity cùng DB transaction.
- Chuyển quyền, rời/giải tán với xác nhận; lưu trữ hành trình cho cả hai, xem lịch sử chỉ đọc, giữ dữ liệu.
- Ngày bắt đầu, số ngày bên nhau, nhắc kỷ niệm trên tổng quan; bảng hoạt động phân trang và cập nhật khi mở trang.
- Guard `requireCouple`, chống đọc lịch sử của nhóm khác, đồng bộ coupleId khi người kia rời. Xóa tài khoản kiểm tra membership trong transaction để tránh race.
- Nền tảng kiểm tra công nợ còn tồn tại và yêu cầu xác nhận riêng. Chưa có quỹ/chia tiền/settlement đầy đủ ở giai đoạn 4; không hiển thị số nợ giả.

## 2. File mới/sửa

Mới:

- `apps/api/src/modules/couples/models.ts`, `schema.ts`, `repository.ts`, `service.ts`, `controller.ts`, `routes.ts`, `openapi.ts`, `tests/couples.test.ts`.
- `apps/api/src/middlewares/requireCouple.ts`.
- `apps/web/src/features/couples/types.ts`, `api.ts`, `CouplePage.tsx`.
- `apps/web/src/test/couples.test.tsx`, `docs/PHASE_4.md`.

Sửa:

- API `src/app.ts`, `config/db.ts`, `config/openapi.ts`, `modules/users/service.ts`.
- Web `src/app/App.tsx`, `features/auth/AuthPage.tsx`, `features/dashboard/AccountHome.tsx`, `styles/global.css`.
- `README.md`, `docs/API.md`, `docs/DECISIONS.md`.

Ảnh trong outputs: `mam-chung-phase-4.jpg` (hai thành viên active), `mam-chung-couple-mobile.jpg` (390×844), `mam-chung-couple-archive.jpg` (người còn lại xem lịch sử). Đều là tài khoản QA giả lập; hai tài khoản đã vô hiệu hóa sau kiểm tra. Tài khoản demo và dữ liệu hiện hữu được giữ nguyên.

## 3. Cách chạy và kiểm tra

Mở `outputs/mam-chung`, yêu cầu Node.js ≥20:

```powershell
npm ci
npm run dev:local
```

Đăng nhập: http://127.0.0.1:5173/login. Couple: http://127.0.0.1:5173/couple. Swagger: http://127.0.0.1:4000/api/docs.

Dùng hai tài khoản riêng: A tạo hành trình và mã; B nhập mã hoặc mở link, đăng nhập và chấp nhận. A thấy B sau tối đa một chu kỳ cập nhật 5 giây. Để rời: owner có partner cần chuyển quyền trước; member xác nhận lưu trữ. Cả hai mở danh sách hành trình cũ để xem feed; không còn nút sửa/ghi ở lịch sử.

```powershell
npm run lint
npm test
npm run build
npm run format:check
```

Local runner giữ `.local/data` và secret ngoài Git. Dừng runner cũ trước khi chạy mới; sửa backend cần khởi động lại. Test dùng MongoDB replica set riêng, không xóa dữ liệu local. Có thể tái dùng binary qua `MONGOMS_DOWNLOAD_DIR`. Docker chưa chạy thực tế vì máy chưa cài Docker.

## 4. Kết quả kiểm tra

- Backend **124/124 đạt**: 27 kiểm tra Couple mới và 97 kiểm tra trước. Bao gồm random/hash/48h/expired/used/revoked/self/full, ownership, tạo và ghép đồng thời, một user hai lời mời, unique index, rollback create/accept/archive, transfer, lưu trữ, quyền lịch sử/feed, công nợ giữ nguyên và race xóa tài khoản.
- Frontend **64/64 đạt**: 15 kiểm tra mới và 49 kiểm tra trước. Bao gồm tạo/ngày, xem lời mời trước accept, owner/member, hiển thị mã, thu hồi cần xác nhận, chuyển quyền, xác nhận lưu trữ/công nợ, archive read-only, dashboard anniversary và đồng bộ membership từ server.
- Coverage Couple service: **95,86% statements, 85,36% branches, 100% functions, 98,62% lines**. Tổng service **98,21% statements, 90,18% branches, 100% functions, 98,99% lines**; vượt yêu cầu 80%.
- TypeScript/lint, API/web build và format đạt. Vite còn cảnh báo bundle lớn, tối ưu tải ở giai đoạn hoàn thiện. Các cảnh báo Recharts trong DOM giả lập từ báo cáo tài chính cũ không phải lỗi test.
- QA local có hai phiên tài khoản được xác thực. A tạo hành trình bằng UI; nhập ngày 03/10/2020, UI ngày 03/10/2026 hiển thị **2.191 ngày** và nhắc kỷ niệm hôm nay. CUA nhập date qua setValue để phát sinh thay đổi đúng trên native date control.
- A tạo mã/link bằng UI; B preview và accept qua API với phiên riêng; UI A tự thấy hai thành viên và activity joined. Unit/REST test bao phủ accept và page lời mời.
- A chuyển quyền cho B bằng UI, trở thành member, rồi xác nhận rời bằng UI. Sau đó cả hai GET /couples/me đều null, có một archive, cả hai membership inactive, feed giữ đủ **6 hoạt động**. Không xóa hoặc hoàn nguyên dữ liệu cá nhân.
- Đăng nhập B bằng UI, mở archive: thấy cả hai thành viên/ngày kỷ niệm/feed, không có nút sửa/transfer/leave ở archive. Viewport **390×844** kiểm tra thẻ hai người, kỷ niệm và modal xác nhận vừa trang.
- Khi chỉnh hook trực tiếp trong lúc Vite chạy, phiên cũ có cảnh báo HMR về hook order; đã kiểm tra lại trên tab mới sau khi hoàn thiện. Phiên cuối không có lỗi console.
- OpenAPI hiện **40 đường dẫn, 63 schema**, không có tham chiếu schema thiếu.
- Hai tài khoản QA đã vô hiệu hóa, lịch sử QA giữ để audit. Web để ở đăng nhập; tài khoản demo vẫn dùng như trước.
- GitHub CI, Docker, quỹ/chia tiền/settlement thực, HTTPS/domain chưa được chạy/triển khai trong giai đoạn này.

## 5. Quyết định/giả định

Chi tiết ở `docs/DECISIONS.md`: tối đa hai người; transaction + khóa user/couple + unique active membership; code chỉ lưu hash/hiển thị một lần, không tự gửi cho người khác. Rời lưu trữ toàn bộ couple cho hai người để ledger cũ không bị trộn với partner mới. Archived chỉ đọc và scoped theo thành viên cũ; snapshot tên/ảnh, không email. Owner phải chuyển quyền trước khi rời cùng partner. Công nợ chưa trả cần confirmOutstanding riêng, không bị xóa. Giai đoạn 5 phải kiểm tra active/lock trong shared service, không chỉ middleware. Kỷ niệm theo timezone người xem, 29/02 dùng 28/02 trong năm không nhuận. UI cập nhật mỗi 5 giây và trên focus, chưa dùng WebSocket.

## 6. Tiếp theo

**Giai đoạn 5 — Tài chính chung:** quỹ và nạp quỹ, giao dịch trả từ quỹ/cá nhân, chia đều/custom/percent, công nợ ròng, đã trả/chờ xác nhận/xác nhận/từ chối, mục tiêu chung, dashboard và kiểm thử số dư/split/settlement nghiêm ngặt. Todo, fitness, thông báo, hoàn thiện và triển khai tiếp sau đó. Đã hoàn thành đến giai đoạn 4, chưa phải toàn bộ acceptance checklist website.
