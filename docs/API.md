# API giai đoạn 1–2

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

## Tài chính cá nhân (giai đoạn 2)

Mọi endpoint dưới đây cần `Authorization: Bearer <accessToken>`. ID tài nguyên phải là ObjectId 24 ký tự hex; tài nguyên không thuộc tài khoản trả 404. Body và query strict, không nhận userId/balance/currency tùy ý. Input sai trả 400; thiếu số dư trả 422; ví lưu trữ hoặc quy tắc xung đột trả 409. Swagger gồm schema request/response và tham số.

| Endpoint                         | Nội dung                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------- |
| GET/POST /wallets                | Danh sách phân trang; tạo ví với initialBalance ≥0                               |
| GET/PUT/DELETE /wallets/:id      | Xem/sửa; DELETE chỉ ví chưa có lịch sử                                           |
| POST /wallets/transfer           | fromWalletId, toWalletId, amount, date, description; trả transferId và hai dòng  |
| POST /wallets/:id/reconcile      | `{repair:false}` kiểm tra; `{repair:true}` sửa theo sổ                           |
| GET/POST /categories             | Hệ thống + riêng, lọc type; tạo danh mục riêng                                   |
| PUT/DELETE /categories/:id       | Sửa riêng; DELETE có `{replacementId}` khi đã có lịch sử                         |
| GET/POST /transactions           | Lịch sử phân trang và tổng kết quả lọc; ghi thu/chi                              |
| GET/PUT/DELETE /transactions/:id | Xem/sửa/xóa; xóa chuyển tiền sẽ xóa cả cặp                                       |
| POST /transactions/:id/duplicate | `{}` ngày hiện tại, hoặc `{date}`; chỉ giao dịch thường                          |
| GET /finance/dashboard           | Số dư, thu/chi tháng, tỷ lệ thay đổi, chi theo danh mục, ví, 5 giao dịch gần đây |

Query phân trang: `page=1`, `limit=20` (1–100). Ví nhận thêm `archived=true/false`, bỏ trống lấy cả hai. Danh mục nhận `type=income/expense`. Lịch sử nhận `from`, `to` (YYYY-MM-DD), `walletId`, `categoryId`, `type=income/expense/transfer/opening`, `search` (≤100 ký tự), `sort=date_desc/date_asc/amount_desc/amount_asc`. Thứ tự luôn có ID làm khóa phụ. `summary.income/expense/net` tính toàn bộ kết quả lọc, không chỉ trang hiện tại; loại trừ opening và transfer.

Tạo giao dịch:

```json
{
  "type": "expense",
  "amount": 55000,
  "walletId": "ID_VI_24_HEX",
  "categoryId": "ID_DANH_MUC_24_HEX",
  "date": "2026-10-03",
  "description": "Bữa trưa",
  "notes": "",
  "tags": ["công việc"]
}
```

Số tiền nguyên VND >0, tối đa 9007199254740991; không dùng số thực. Danh mục phải cùng loại giao dịch và thuộc hệ thống hoặc chính tài khoản. Ngày có thể là date-only (12:00 theo múi giờ hồ sơ) hoặc ISO8601 kèm offset. Mô tả 1–200 ký tự, ghi chú ≤1000, ≤10 nhãn, mỗi nhãn 1–30 ký tự. PUT nhận một hoặc nhiều trường, không nhận kind/transferId. Opening bất biến; transfer không sửa/nhân bản riêng lẻ. Mọi cập nhật số dư cùng transaction với sổ.

`incomeChange/expenseChange` là % so với tháng trước, null khi tháng trước bằng 0. Số dư dashboard gồm ví lưu trữ. Ngân sách/mục tiêu/định kỳ/reports/CSV được bổ sung ở giai đoạn 3 bên dưới.

## Giai đoạn 3 — Kế hoạch tài chính

Tất cả endpoint cần Bearer và kiểm tra quyền theo người dùng ở service; input strict Zod. Không nhận `userId`, số dư/progress/spent hay trạng thái chạy từ client. Thiếu tiền 422; trùng ngân sách hoặc tài nguyên đang tham chiếu 409; tài nguyên ngoài quyền 404.

| Endpoint                                        | Nội dung                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET /budgets?month=YYYY-MM                      | Mặc định tháng hiện tại theo timezone; items gồm spent, remaining, progress, status                      |
| POST /budgets                                   | categoryId (chi), month, amount nguyên VND >0; duy nhất danh mục/tháng/người dùng                        |
| PUT/DELETE /budgets/:id                         | Sửa một hoặc nhiều trường / soft delete                                                                  |
| GET/POST /goals                                 | Danh sách / tạo với name, targetAmount, deadline date hoặc null, notes, color                            |
| PUT/DELETE /goals/:id                           | Sửa mục tiêu / soft delete, giữ lịch sử audit                                                            |
| POST /goals/:id/contribute                      | amount, date (date-only hoặc ISO offset), notes; tăng savedAmount nguyên tử                              |
| GET /goals/:id/contributions?page=1&limit=20    | Lịch sử phân trang, sort mới nhất                                                                        |
| DELETE /goals/:id/contributions/:contributionId | Hoàn tác một khoản ghi nhận; giảm savedAmount và soft delete cùng transaction                            |
| GET/POST /recurring                             | Danh sách / tạo mẫu giao dịch kèm frequency weekly/monthly, nextDate, endDate hoặc null, enabled         |
| PUT/DELETE /recurring/:id                       | Sửa, bật/tạm dừng / soft delete; giữ giao dịch đã sinh                                                   |
| POST /recurring/:id/run                         | Body `{}`; thử chạy bù đến hôm nay, tối đa 100 kỳ/lượt; trả created, error, catchUpLimit                 |
| GET /reports/monthly?months=6&endMonth=YYYY-MM  | 6 hoặc 12 tháng liên tiếp, mặc định đến tháng hiện tại; thu/chi/net, category totals/trends, comparisons |
| GET /reports/by-category                        | Cùng bộ lọc và payload báo cáo; dùng categories cho xu hướng chi                                         |
| GET /transactions/export                        | CSV attachment UTF-8 BOM, cùng bộ lọc/sort lịch sử, không phân trang                                     |

Ngân sách chỉ tính expense/kind=transaction chưa xóa, ranh giới ngày/tháng theo timezone hồ sơ; opening/transfer không tính. Ngưỡng cảnh báo dùng so sánh số nguyên chính xác. Tiến độ hiển thị một chữ số thập phân, không phải số dư tiền.

Dành dụm cho mục tiêu không tạo expense hay tự trừ ví. Người dùng đang ghi nhận phần tiền đã để riêng. Có thể vượt mục tiêu; hoàn tác không được chạy hai lần. Mục tiêu chung sẽ thuộc giai đoạn tài chính chung.

Mẫu định kỳ dùng trường của POST /transactions trừ date; nextDate/endDate là YYYY-MM-DD. Job chạy khi khởi động và kiểm tra mỗi phút; chỉ ghi kỳ đến hạn theo ngày địa phương của người dùng. Ngày 29–31 giữ anchor: 31/01 → 28/02 → 31/03. Hết endDate tự tắt. Kỳ thất bại giữ nextDate/lỗi; job tự thử lại ngày địa phương kế tiếp hoặc người dùng dùng /run ngay sau khi sửa nguyên nhân. Mỗi kỳ có khóa (recurringId, scheduledDate); ghi sổ, số dư, khóa và nextDate cùng transaction. Xóa dòng sổ đã sinh không làm job tạo lại cùng kỳ.

CSV nhận `from`, `to`, `walletId`, `categoryId`, `type`, `search`, `sort` như lịch sử. `page/limit` được parser chấp nhận nhưng không giới hạn kết quả xuất. Trên 10.000 dòng trả 422 và yêu cầu lọc hẹp hơn. Mọi ô được quote/escape, trường văn bản có tiền tố nguy hiểm được thêm dấu apostrophe; ngày giờ ISO UTC, tiền là số nguyên VND. CSV có cả opening/transfer khi bộ lọc cho phép; cột Bản ghi giúp phân biệt với thu/chi thường.
