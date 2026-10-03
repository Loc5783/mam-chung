# Giai đoạn 6 — Công việc

Đã triển khai mục 9 của master prompt: công việc cá nhân/chung, phân công, hạn, ưu tiên, checklist, lặp lại, bình luận ngắn và danh sách mua sắm chung. Mở tại `/tasks`, từ thanh điều hướng hoặc Không gian chung. Giai đoạn7 tập luyện chưa triển khai.

## Chức năng

- CRUD đầy đủ; cá nhân chỉ chủ sở hữu thấy, chung cả hai thấy và sửa được.
- Danh sách hoặc Kanban bốn cột Cần làm / Đang làm / Hoàn thành / Đã hủy. Chọn trạng thái trên thẻ để chuyển cột; hoàn thành ghi thời gian.
- Lọc cá nhân/chung/giao cho tôi, trạng thái, ưu tiên, hạn, khoảng ngày, nhãn; tìm kiếm tiêu đề/mô tả/nhãn; sắp xếp và phân trang.
- Việc con có tick; shopping chung dùng danh sách món mua cùng lịch sử bình luận của task.
- Lặp hằng ngày/tuần/tháng: hoàn thành sinh một bản tiếp theo theo hạn cũ, reset tick và giữ người được giao. Tháng ngắn giữ anchor ngày gốc.
- Bình luận trên task chung, tên người gửi, thời gian theo timezone hồ sơ, phân trang.
- Dashboard có việc hôm nay và quá hạn, nút Xong nhanh; không lấy dữ liệu minh họa làm dữ liệu thật.
- Couple lưu trữ giữ tasks/comments chỉ đọc; truy cập từ trang lịch sử couple. Công việc riêng và hành trình mới không bị trộn vào lịch sử cũ.

## Kiểm tra

- 191 kiểm thử API đạt, gồm25 kiểm thử mới. Service tasks bao phủ 100% lines/functions; statements và branches trên90%.
- 100 kiểm thử giao diện đạt, gồm15 kiểm thử mới cho form, Kanban, checklist, shopping, revision, bình luận, xóa xác nhận và archived.
- Kiểm thử đồng thời hai thành viên: chỉ một cập nhật revision thành công; hoàn thành cùng lúc chỉ tạo một successor. Lỗi tạo successor rollback trạng thái và feed.
- Kiểm tra anchor31 →28/02 →31/03; daily/weekly qua tháng; không tái tạo successor đã xóa; chặn ngày sau9999, ngày sai và lặp không hạn.
- Bản local với hai tài khoản QA: việc cá nhân không lộ cho người kia; cả hai thấy việc chung và bình luận. Tick Sữa tươi được người kia đọc lại đúng.
- Tạo Tưới cây từ giao diện ngày3/10/2026: thiếu hạn bị chặn; DONE sinh ngày4/10, checklist từ1/1 thành0/1. API đọc lại xác nhận đúng hai bản.
- Rời couple giữ5 việc chung và bình luận; write/status/comment bị chặn. Bốn việc cá nhân của Minh vẫn còn trong scope personal.
- Kiểm tra desktop và viewport390×844: không tràn ngang; modal form cuộn được, một cột trên điện thoại. Lint/build/format đạt.

## Quy tắc cần biết

Revision cũ trả409 thay vì ghi đè thay đổi của partner. Đóng/mở lại form để lấy bản mới. Lặp không tự chạy nền: mỗi lần hoàn thành sinh một bản tiếp theo, hạn dựa hạn cũ nên việc chậm có thể sinh bản đã quá hạn. Reopen việc cũ không sinh bản trùng; xóa bản cũ không xóa bản mới. Không chuyển scope khi sửa. Mua sắm là checklist, không tự ghi giao dịch tài chính.

## Chạy thử

`npm run dev:local` → đăng nhập → Công việc. Có thể bắt đầu với việc cá nhân mà không cần couple. Để thử phân công/bình luận/mua sắm chung: tạo couple và ghép người thứ hai tại `/couple`, rồi chọn Không gian Chung khi thêm việc.

API và schemas ở Swagger `/api/docs`, [API.md](API.md); các quyết định ở [DECISIONS.md](DECISIONS.md). Đây là bản phát triển local; Docker/production chưa được kiểm tra. Thông báo đầy đủ thuộc giai đoạn8. Tài khoản demo/dữ liệu hiện hữu được giữ nguyên; QA dùng tài khoản giả riêng và xóa mềm sau kiểm tra.
