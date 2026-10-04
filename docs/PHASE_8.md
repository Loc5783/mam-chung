# Giai đoạn 8 — Dashboard tổng hợp và thông báo trong ứng dụng

Đã triển khai mục11 và giai đoạn8 của master prompt. Mở `/` sau đăng nhập và chuông trên thanh đầu trang. Giai đoạn9 (PWA/a11y/hiệu năng/seed demo) còn tiếp theo; chưa triển khai production.

## Chức năng

- Dashboard một API: lời chào/ngày theo hồ sơ, số dư cá nhân/thu/chi tháng, donut danh mục, ví, ngân sách; việc hôm nay và quá hạn có Xong; tập gần nhất/số buổi/volume tuần/mini chart. Không kéo query riêng cho từng preview.
- Khi có cặp active: tên thành viên, số ngày bên nhau/ngày kỷ niệm, số dư quỹ riêng, nợ ròng/khoản đang chờ, năm hoạt động gần đây. Không có cặp trả null, không giả số tiền chung bằng0.
- Bốn hành động nhanh mở đúng biểu mẫu giao dịch/chi chung/việc/buổi tập. Chi chung khi chưa ghép đôi mở Couple. Link công nợ từ thông báo chọn đúng tab.
- Chuông đếm chưa đọc, modal, đọc một/đọc tất cả, lọc chỉ chưa đọc, phân trang và link chi tiết. Bảy loại nhắc gồm lời mời/ghép đôi, nợ chung, xác nhận tiền, việc được giao, hạn việc và ngân sách chạm/vượt100%.
- Privacy dựa tài khoản và membership hiện tại, không lộ mã/hash lời mời, dữ liệu riêng partner. Không trùng khi tải lại/đọc đồng thời; giữ readAt, lượt giao lại hoặc yêu cầu nhận tiền mới có nhắc mới. Nhắc đã xử lý/hết hạn tự ẩn.
- Đổi timezone làm mới Dashboard/thông báo. Phiên cũ không được ghi hồ sơ hoặc điều hướng sau chuyển tài khoản. Lỗi API có retry, không dựng số0 giả.

## Kiểm chứng ngày4/10/2026

- Toàn bộ API **231/231** kiểm thử qua; thêm20 kiểm thử Dashboard/thông báo với rollback, race, unique, read ownership/idempotency, lọc/pagination, timezone, giao lại, công nợ, lời mời, ngân sách, archive và strict HTTP. Chạy lại20 kiểm thử sau bổ sung từ chối query ngoài schema.
- Toàn bộ web **134/134** kiểm thử qua; thêm14 cho Dashboard/chuông và2 cho timezone/response hồ sơ cũ. Kiểm tra one-request, tạo nhanh, Done gửi revision, data thật, retry, read/read-all/deep-link, lỗi không điều hướng, route ngoài bị chặn, co trang và epoch phiên.
- Coverage Dashboard service100% cả bốn chỉ số; Notifications98,29% statements /89,28% branches /100% functions /99,08% lines. Các phép đo từ lượt kiểm tra riêng20 test; toàn bộ API qua threshold80% chung.
- Lint, build và format qua. Build vẫn có cảnh báo bundle965,89KB; tối ưu chia trang thuộc giai đoạn9. Không coi cảnh báo kích thước là runtime failure.
- API local với ba tài khoản giả: ví1.000.000 trừ chi240.000 =760.000đ, budget200.000→120%; quỹ nạp300.000đ; khoản ứng101 chia51/50, nợ50đ; buổi45 phút với80×8=640 volume. Người thứ hai số dư riêng0/tập0. Người ngoài đọc thông báo tài khoản đầu trả404 và danh sách riêng trống. Lời mời người nhận chỉ sau preview mã hợp lệ và JSON không chứa mã.
- Trình duyệt: Dashboard hiển thị đúng các con số và100 ngày bên nhau. Mở thông báo xác nhận tiền dẫn `/shared?tab=settlements`; xác nhận khoản QA làm công nợ về0 và cả nhắc nợ/yêu cầu ẩn. Xong việc riêng làm nhóm hôm nay giảm2→1 và nhắc hạn ẩn. Tạo việc nhanh lưu thành công, xuất hiện Dashboard và nhắc hạn. Cả bốn nút nhanh mở đúng form.
- Read-all với chỉ chưa đọc đưa count3→0 và danh sách trống. Đổi sang người thứ hai trong cùng trình duyệt vẫn thấy0 ví/thu/chi/tập và việc riêng của họ; không thấy ngân sách/việc riêng/sổ tập của người đầu. Đọc nhắc được giao rồi hoàn thành việc chung làm nhắc giao/hạn ẩn, count3→2. Không có console error ở tab QA. Kiểm tra OpenAPI đã đóng gói có84 paths/117 schemas và không có reference schema bị thiếu.
- Desktop1280×720 và mobile390×844: Dashboard/modal đọc được. Phát hiện tooltip Fitness còn tọa độ desktop gây tràn ngang sau resize; sửa clipping trong khung chart, kiểm tra document scrollWidth375≤390. Có ảnh `mam-chung-phase-8.png`, `mam-chung-phase-8-mobile.png`, `mam-chung-phase-8-notifications.png`, `mam-chung-phase-8-mobile-notifications.png`, `mam-chung-phase-8-private.png` ngoài repo; dữ liệu trong ảnh là giả trước khi dọn.
- Đã dọn đúng ba tài khoản QA, bốn task và buổi tập, xóa mềm chi/budget; archive ví/cặp, giữ lịch sử tiền. Token cũ401; trước xóa cả ba có coupleId=null và notifications0. Phiên demo trên127.0.0.1 và hai tab người dùng không bị thay đổi; QA dùng frontend loopback riêng rồi đóng.

## Quy tắc và giới hạn

Thông báo được đồng bộ khi đọc API, trong transaction khóa user. UI poll15 giây và focus khi trang đang mở; không có worker/email/SMS/push. Điều kiện tồn tại rồi kết thúc giữa hai lần đồng bộ không được ghi như lịch sử; reminder khác audit feed. Nhắc hạn hôm nay/ngày mai/quá hạn dùng ngày hồ sơ. Read-all chỉ tài khoản hiện tại. Source chấm dứt làm nhắc inactive; nếu sau đó active lại và đã đồng bộ thấy ngừng, reset unread.

Mã mời không có email người nhận; receipt chỉ lưu userId/inviteId sau preview hợp lệ. Thông báo mở Couple, cần nhập lại mã tự nhận; không lưu hoặc gửi plaintext code. Budget nhắc100%; thẻ hiển thị80%. Dashboard đọc nhiều dịch vụ tuần tự, không bảo đảm snapshot nguyên tử xuyên mô-đun; lỗi thật trả cho UI.

Đã kiểm chứng bản phát triển local với MongoDB replica set, chưa xác nhận Docker trên máy trống, HTTPS/domain, CI GitHub, khả năng PWA/offline hoặc hiệu năng lịch sử lớn. Các phần đó thuộc giai đoạn9–11.

## Các file chính

- API: `modules/dashboard/{service,routes,openapi}.ts`, `modules/notifications/{models,schema,service,routes}.ts`, `modules/notifications/tests/notifications.test.ts`; mount/init và OpenAPI; receipt tại Couple preview; version giao việc nội bộ.
- Web: `features/dashboard/{AccountHome,types}`, `features/notifications/NotificationBell.tsx`, các preview nhận dữ liệu/API hooks; route add/tab ở Tasks/Fitness/Shared, timezone và epoch Settings, CSS responsive, `test/dashboard*` và `test/app.test.tsx`.
- Tài liệu: README, API, DECISIONS, PHASE_8.
