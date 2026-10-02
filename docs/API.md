# API giai đoạn 1

Swagger: GET /api/docs. OpenAPI JSON: GET /api/openapi.json.

| Method | Endpoint                  | Nội dung                                        | Xác thực |
| ------ | ------------------------- | ----------------------------------------------- | -------- |
| GET    | /api/health               | 200 khi DB sẵn sàng, 503 nếu chưa               | Không    |
| POST   | /api/auth/register        | name, email, password                           | Không    |
| POST   | /api/auth/login           | email, password                                 | Không    |
| POST   | /api/auth/refresh         | Cookie refreshToken; xoay vòng                  | Cookie   |
| POST   | /api/auth/logout          | Thu hồi phiên hiện tại, xóa cookie              | Bearer   |
| POST   | /api/auth/change-password | currentPassword, newPassword; thu hồi mọi phiên | Bearer   |
| GET    | /api/users/me             | Hồ sơ an toàn                                   | Bearer   |
| PUT    | /api/users/me             | name, avatar (HTTPS/null), timezone (IANA)      | Bearer   |
| DELETE | /api/users/me             | password xác nhận                               | Bearer   |

Login/register/refresh trả `{ accessToken, user }`. `user` chỉ chứa id, email, name, avatar, timezone, coupleId và createdAt. Refresh token chỉ đặt trong cookie httpOnly `refreshToken`, path `/api/auth`, 7 ngày, SameSite=Strict, Secure ở production. Không có passwordHash hoặc refresh token trong JSON.

Access JWT: HS256, exp 15 phút, issuer mam-chung, audience mam-chung-web. Mọi request được xác thực với người dùng và trạng thái phiên trong DB, không chỉ chữ ký. `userId`/`coupleId` luôn lấy từ dữ liệu xác thực phía server; body có các trường thừa bị từ chối.

PUT profile không sửa email. `avatar` là URL HTTPS, không hỗ trợ upload ở giai đoạn này. Đổi mật khẩu và xóa tài khoản trả 204 và yêu cầu đăng nhập lại. Logout trả 204, chỉ thu hồi family hiện tại.

Lỗi: `{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu không hợp lệ.", "details": [{ "path": ["email"], "message": "Email không hợp lệ.", "code": "invalid_string" }] } }`.

Status: 400 input/mật khẩu xác nhận sai; 401 phiên/đăng nhập không hợp lệ; 403 Origin ngoài whitelist; 409 email trùng/couple chưa rời; 423 tài khoản tạm khóa; 429 giới hạn request.

Các API tài chính/couple/todo/fitness chưa tồn tại. Các tiện ích health/docs/OpenAPI được công khai để vận hành.
