# Giai đoạn 5 — Tài chính chung

Đã triển khai tài chính chung cho couple tại `/shared`, nối từ tổng quan và trang Không gian chung. Giai đoạn 6 (công việc) chưa triển khai.

## Chức năng

- Nhiều quỹ, đổi tên, lưu trữ/khôi phục, đóng góp và lịch sử theo người góp.
- Khoản chi từ quỹ hoặc ứng cá nhân; chia đều, tùy chỉnh số tiền, phần trăm. Xem chi tiết phần chia, bộ lọc ngày/quỹ, phân trang và xóa theo quyền.
- Công nợ tự tạo từ tiền ứng; quy trình báo đã trả → người nhận xác nhận/từ chối, ghi chú và lịch sử. Tổng hợp công nợ ròng hai chiều.
- Mục tiêu chung có hạn, tiến độ, đóng góp, lịch sử và hoàn tác theo quyền.
- Dashboard số dư quỹ, chi tháng theo danh mục, khoản gần đây, công nợ và mục tiêu. Bố cục thích ứng điện thoại.
- Rời couple giữ nguyên sổ chung; thành viên cũ xem lịch sử chỉ đọc. Không sửa hoặc thanh toán sau khi archived.

## Bảo vệ logic

Mỗi thay đổi dùng MongoDB transaction và khóa parent couple để tránh đồng thời chi tiền, rời couple hoặc cập nhật trạng thái thanh toán. Tổng chia phải khớp từng đồng; BigInt dùng khi cộng/chia để tránh sai số lớn. Chỉ người nợ báo trả, chỉ người nhận xác nhận; creator/owner mới xóa khoản chi. Không xóa khoản có nợ paid hoặc pending_confirm. Quỹ đã có lịch sử chỉ lưu trữ, không xóa.

Tiền đóng góp và trả nợ là ghi nhận tiền chuyển ngoài app. Mục tiêu theo dõi tiền để riêng, không tự trừ quỹ/ví. Công nợ ròng không tự thanh toán các khoản đối ứng. Danh mục chung dùng danh mục chi hệ thống; tài chính cá nhân vẫn riêng tư.

## Kiểm tra

- 166 kiểm thử API đạt, gồm 31 kiểm thử mới cho tài chính chung. Coverage service shared: statements 98,23%, branches 88,27%, functions 100%, lines 99,03%.
- 85 kiểm thử giao diện đạt, gồm 14 kiểm thử mới cho form, quyền và cache tài chính chung.
- Kiểm tra trực tiếp hai tài khoản QA local: nạp tổng 800.000 đ, chi quỹ 240.001 đ còn 559.999 đ; ứng hai chiều cho công nợ ròng 110.000 đ. Xác nhận khoản 150.000 đ đổi số ròng thành 40.000 đ theo chiều ngược lại.
- Trên giao diện, chia 101 đ thành 50/50 bị chặn; 50/51 lưu thành công, quỹ còn 559.898 đ, tổng chi tháng 640.104 đ. Chi từ quỹ không tạo nợ.
- Archived giữ số dư và chặn write; giao diện bỏ các nút sửa/nạp/xóa. Kiểm tra viewport 390×844 không tràn ngang.
- Lint, build và kiểm tra định dạng đạt. Tài khoản demo và dữ liệu có sẵn được giữ nguyên.

## Chạy thử

`npm run dev:local`, đăng nhập, tạo couple tại `/couple` và ghép thành viên thứ hai bằng mã mời. Mở `/shared`, tạo quỹ, ghi nạp rồi tạo khoản chi. Đổi tài khoản để thử báo trả và xác nhận từ hai phía.

API/DTO: [API.md](API.md). Quyết định nghiệp vụ: [DECISIONS.md](DECISIONS.md). Đây là bản phát triển local; Docker/triển khai production chưa được kiểm tra ở giai đoạn này. Thông báo đầy đủ thuộc giai đoạn 8; hiện có feed hoạt động và cập nhật khi mở trang.
