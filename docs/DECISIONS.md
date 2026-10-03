# Quyết định triển khai

- Làm tuần tự và dừng sau giai đoạn 0 theo mục 17. Chưa triển khai nghiệp vụ hoặc xác thực; không giả lập đăng nhập thành công.
- Tổng quan có dữ liệu minh họa được ghi nhãn rõ để đánh giá thiết kế. Các trang nghiệp vụ có trạng thái chờ triển khai, không lưu dữ liệu tài chính trong trình duyệt.
- Giữ React 18/Vite/TypeScript và Express/Mongoose theo yêu cầu; không thay MongoDB bằng dịch vụ lưu trữ khác.
- API chỉ khởi động khi MongoDB có replica set; health trả 503 khi chưa kết nối.
- API health và tài liệu Swagger được công khai để kiểm tra vận hành. Các endpoint nghiệp vụ tương lai phải xác thực.
- Không triển khai domain thật khi chưa có máy chủ và domain. Cấu hình production hiện là nền tảng, chưa phải bản đủ điều kiện production.
- Service worker và icon PNG cài đặt đa nền tảng thuộc giai đoạn 9. Giai đoạn 0 cung cấp manifest và favicon SVG.
- Các bài kiểm thử DB replica set và bảo mật xác thực thuộc các giai đoạn có nghiệp vụ tương ứng; không tuyên bố đã kiểm tra transaction DB ở giai đoạn 0.

## Giai đoạn 1

- Bcrypt cost 12; mọi mật khẩu nhập vào tối đa 72 byte để tránh bcrypt bỏ phần dư. Email trim/lowercase; body strict; schema cũng được kiểm tra tại service.
- Refresh token ngẫu nhiên 48 byte (base64url 64 ký tự); DB chỉ giữ SHA-256. Token đã dùng được giữ tới TTL hết hạn để phát hiện reuse. Rotation và thu hồi trong transaction.
- Reuse token đã consumed thu hồi tất cả family của tài khoản và tăng securityVersion; password change/delete cũng tăng version. Middleware kiểm tra DB mỗi request để access token cũ không dùng được sau thu hồi.
- Touch sessionRevision trên user trong các transaction phiên để serialize refresh/logout/đổi mật khẩu/xóa tài khoản. Refresh lỗi tạo token mới rollback giữ token cũ. Logout chỉ thu hồi family hiện tại.
- Access token chỉ nằm trong bộ nhớ frontend; refresh httpOnly SameSite=Strict/Secure production. Không lưu token vào localStorage. Web Locks phối hợp refresh giữa tab khi trình duyệt hỗ trợ; trình duyệt không hỗ trợ có thể bị yêu cầu đăng nhập lại khi refresh đồng thời (ưu tiên an toàn).
- Khóa 15 phút sau 5 lần sai liên tiếp; login/register chung giới hạn 10 lần/phút/IP. Origin ngoài whitelist bị từ chối trên các request thay đổi dữ liệu. TRUST_PROXY_HOPS khai báo rõ số reverse proxy, không tin mọi X-Forwarded-For.
- Xóa tài khoản là soft delete, ẩn danh tên/email/avatar, thu hồi toàn bộ phiên. Chưa có tự khôi phục. Nếu đang có coupleId phải rời/giải tán trước; việc lưu trữ dữ liệu chung sẽ bổ sung ở giai đoạn 4.
- Avatar dùng URL HTTPS, hiển thị ở sidebar/topbar; không upload file hay gửi email/SMS. Múi giờ dùng tên IANA và được kiểm tra bằng Intl.
- Sau đăng nhập, tổng quan thật hiển thị trạng thái chờ nghiệp vụ; dữ liệu mẫu chuyển sang /preview. Không giả lập số dư tài khoản thật.
- Cung cấp npm run dev:local để chạy replica set riêng trên loopback, dữ liệu persistent trong .local/data; vẫn giữ Docker theo stack bắt buộc. Jest dùng DB khác hoàn toàn.
- API khởi động sau khi xác nhận replica set và tạo xong unique indexes. Production từ chối JWT_SECRET chứa giá trị placeholder.
- Giai đoạn 1 chưa bao gồm triển khai domain, backup MongoDB hoặc bảo vệ DB production; các hạng mục này thuộc giai đoạn 11.

## Giai đoạn 2 — Tài chính cá nhân

- VND là số nguyên trong phạm vi Number.MAX_SAFE_INTEGER. Tính toán bằng BigInt, aggregate chuyển Long → Decimal128 để tránh làm tròn double trước khi cộng; tổng vượt phạm vi trả lỗi thay vì làm tròn.
- Mọi thay đổi ví, danh mục và giao dịch chạy trong MongoDB transaction. Chạm sessionRevision của chủ tài khoản để tuần tự hóa ghi cùng tài khoản, tránh race với sửa/xóa tài khoản hoặc danh mục. MongoDB tự retry write conflict; không cập nhật số dư ngoài transaction.
- Ví mới có số dư ban đầu sinh dòng `kind=opening`; không tính là thu nhập. Dòng này không sửa/xóa qua CRUD giao dịch. Chỉ xóa ví chưa từng có lịch sử; còn lại dùng lưu trữ/khôi phục.
- Ví lưu trữ vẫn thuộc tổng số dư và lịch sử, nhưng chặn ghi/sửa/xóa giao dịch cho tới khi khôi phục. Mặc định chặn số dư âm; tùy chọn allowNegative ở từng ví.
- Chuyển tiền là hai dòng `kind=transfer` liên kết bằng transferId, hai ví cập nhật nguyên tử. Không tính vào thu/chi, không sửa/nhân bản riêng từng dòng. Xóa một dòng xóa cả cặp và hoàn nguyên số dư. Nếu ví nhận đã tiêu tiền, phải xử lý thiếu số dư trước.
- Sửa giao dịch hoàn nguyên bản cũ và áp dụng bản mới, gom delta theo ví rồi kiểm tra số dư cuối. Bởi vậy sửa mô tả hoặc giảm khoản chi không bị chặn vì một số dư trung gian giả.
- 12 danh mục hệ thống seed idempotent; không cho sửa/xóa. Danh mục riêng chuẩn hóa tên để tránh trùng cùng loại. Khi xóa danh mục có lịch sử (kể cả soft deleted), bắt buộc danh mục cùng loại thay thế; giữ giao dịch/số dư nguyên vẹn.
- Tìm kiếm chuỗi thường trong mô tả/ghi chú/nhãn, escape regex. Ngày lọc bao gồm toàn bộ ngày theo múi giờ IANA hồ sơ; date-only ghi lúc 12:00 địa phương. Tổng quan dùng tháng hiện tại theo hồ sơ, null khi không có mẫu so sánh tháng trước.
- Lịch sử phân trang 20 dòng ở UI; tổng thu/chi là toàn bộ kết quả lọc. Dashboard có 5 dòng gần đây, top 5 danh mục chi và gom phần còn lại. Số dư ban đầu/chuyển tiền không đi vào donut hoặc tổng thu/chi.
- Đối soát mặc định chỉ đọc; sửa theo sổ cần repair=true và xác nhận riêng trong UI. Nhân bản tạo giao dịch mới vào ngày hiện tại (hoặc ngày chỉ định), có ảnh hưởng số dư.
- Dữ liệu kiểm tra giao diện được tạo trong tài khoản QA riêng, chỉ là số tiền giả lập. Không seed tiền giả vào tài khoản người dùng thật.
- Giai đoạn 3 mới triển khai ngân sách, mục tiêu, định kỳ, báo cáo nâng cao và CSV theo mục 17 của prompt.
