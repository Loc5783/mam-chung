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
