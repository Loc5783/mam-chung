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

Kiểm thử trình duyệt bổ sung của đợt này chưa hoàn tất do người dùng chuyển sang giai đoạn 5. Các kiểm thử tự động và API local nêu trên đã hoàn tất; không coi chúng là chứng cứ production hoặc bảo đảm không còn lỗi.
