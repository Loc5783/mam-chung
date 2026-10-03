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

## Giai đoạn 4 — Couple

Tất cả endpoint cần Bearer. Mọi quyền kiểm tra lại từ DB trong service, không tin coupleId/role từ client. Một user chỉ có một membership active, một couple tối đa hai thành viên. Mã invalid/expired/used/revoked trả cùng 404; quyền owner thiếu trả 403; đang có couple/full/chưa chuyển quyền/chưa xác nhận công nợ trả 409.

| Endpoint                                           | Nội dung                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| POST /couples                                      | `{name, anniversary?}`; tạo active và membership owner nguyên tử                                            |
| GET /couples/me                                    | `{couple:null}` khi chưa ghép, hoặc DTO active với members, anniversaryInfo, invite metadata, outstanding   |
| PUT /couples/me                                    | Thành viên active sửa tên/ngày kỷ niệm; anniversary null để bỏ, không được ở tương lai                      |
| POST /couples/invite                               | Body `{}`; owner tạo mã 8 ký tự random, 48h, dùng một lần, thu hồi mã trước; trả `{id,code,path,expiresAt}` |
| DELETE /couples/invite                             | Body `{}`; owner thu hồi mọi mã active                                                                      |
| GET /couples/invite/:code                          | Xem tên hành trình, tên người mời, hết hạn và isSelf; chỉ sau đăng nhập, không lộ email/token/dữ liệu chung |
| POST /couples/accept                               | `{code}`; thêm member, dùng mã, cập nhật user cùng DB transaction                                           |
| POST /couples/transfer-owner                       | `{userId}`; owner chuyển cho thành viên active còn lại                                                      |
| DELETE /couples/leave                              | `{confirm:true,dissolve?:boolean,confirmOutstanding?:boolean}`; xem quy tắc bên dưới                        |
| GET /couples/archives?page=1&limit=20              | Các hành trình lưu trữ của chính người dùng; DTO chỉ đọc                                                    |
| GET /couples/archives/:id                          | Thành viên cũ mới xem được, ngoài quyền trả 404                                                             |
| GET /couples/activity?coupleId=...&page=1&limit=20 | Feed phân trang của nhóm active mặc định hoặc archived theo quyền                                           |

Couple DTO không chứa email của người kia, password hash hay mã mời/hash. `invite` chỉ có id/expiresAt, code chỉ hiển thị một lần lúc tạo (không lưu plaintext); nếu chưa lưu có thể tạo mã mới. Mã không được tự gửi qua email/chat. Route tạo/xem/chấp nhận mã giới hạn gộp 10 request/phút/tài khoản, thêm API limit chung theo IP.

Owner có hai người phải chuyển quyền trước khi rời. Owner chỉ còn một mình cần dissolve=true. Member không được dissolve=true. Mọi lần rời đều cần confirm=true. Khi member rời hoặc solo owner giải tán, toàn bộ couple archived, cả hai membership inactive, cả hai user.coupleId=null, thu hồi invite và giữ feed/snapshot tên/ảnh. Cả hai có thể tạo/ghép hành trình mới; không nối người mới vào ledger của hành trình cũ. Không có API sửa archived. Parent couple.status là khóa bảo vệ toàn bộ dữ liệu chung cho các module tiếp theo.

Nếu collection `settlements` còn status `unpaid`, `pending` hoặc `pending_confirm` và chưa xóa thì yêu cầu confirmOutstanding=true riêng. Không sửa/xóa công nợ trong hành động rời. Giai đoạn 5 trả outstanding.summaryAvailable=true; tổng tiền và quy trình thanh toán có tại /settlements. Không hiển thị số nợ giả bằng 0.

Anniversary là ngày 1900-01-01 trở lên, tính số ngày theo timezone người xem. 29/02 dùng 28/02 ở năm không nhuận; nhắc kỷ niệm trên dashboard khi hôm nay hoặc hiển thị số ngày còn lại. Feed ghi thao tác tạo, mời/thu hồi, ghép, sửa, chuyển quyền và lưu trữ trong cùng transaction; không ghi mã/token vào message. `requireCouple` chỉ hỗ trợ guard ban đầu; nghiệp vụ shared tương lai phải kiểm tra/lock active couple trong transaction để ngăn race với rời.

## Giai đoạn 5 — Tài chính chung

Tất cả đường dẫn dưới đây có tiền tố `/api`, cần đăng nhập. Đọc mặc định dùng couple active; truyền `coupleId` để xem couple archived mà người dùng từng tham gia. Write chỉ cho couple active, service kiểm tra lại trong transaction. Ngoài quyền trả 404.

| Endpoint                                               | Nội dung                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| GET, POST /shared-wallets                              | Danh sách hoặc tạo `{name}`; số dư ban đầu 0                   |
| PUT, DELETE /shared-wallets/:id                        | Sửa `{name?,isArchived?}` hoặc xóa quỹ chưa từng có lịch sử    |
| POST /shared-wallets/:id/contribute                    | `{amount,date,notes?}`; người góp là tài khoản hiện tại        |
| GET /shared-wallets/:id/contributions                  | Lịch sử người góp, số tiền, ngày                               |
| GET, POST /shared-transactions                         | Danh sách hoặc tạo khoản chi và phần chia nguyên tử            |
| GET, DELETE /shared-transactions/:id                   | Xem phần chia hoặc xóa theo quyền creator/owner                |
| GET /settlements/summary                               | Công nợ ròng, hướng nợ, số khoản pending/pending_confirm       |
| GET /settlements                                       | Danh sách, bộ lọc trạng thái và lịch sử                        |
| PUT /settlements/:id/mark-paid                         | Người nợ báo đã trả `{notes?}`                                 |
| PUT /settlements/:id/confirm                           | Người nhận xác nhận `{notes?}`, chuyển paid                    |
| PUT /settlements/:id/reject                            | Người nhận từ chối `{notes?}`, trả về pending                  |
| GET, POST /shared-goals                                | Danh sách hoặc tạo `{name,targetAmount,deadline?,color?}`      |
| PUT, DELETE /shared-goals/:id                          | Sửa mục tiêu hoặc soft delete                                  |
| POST /shared-goals/:id/contribute                      | `{amount,date,notes?}`, không đổi số dư quỹ                    |
| GET /shared-goals/:id/contributions                    | Lịch sử dành dụm                                               |
| DELETE /shared-goals/:id/contributions/:contributionId | Hoàn tác, người góp hoặc owner                                 |
| GET /shared/dashboard                                  | Quỹ, chi chung tháng theo danh mục, gần đây, công nợ, mục tiêu |

Tạo khoản chi: `{sharedWalletId,payerId,amount,date,description,categoryId,paidFrom,splitType,splits?}`. `paidFrom` là `fund` hoặc `personal`; `splitType` là `equal`, `custom`, `percent`. Custom dùng `splits:[{userId,shareAmount}]`; percent dùng `splits:[{userId,percent}]`. Hai phần thuộc đúng hai thành viên, không trùng, tổng đúng số tiền hoặc 100%. Chia đều không cần gửi splits. Số đồng lẻ thuộc người trả; percent tối đa hai số thập phân. Danh mục phải là danh mục chi hệ thống.

Các danh sách lịch sử dùng `page` (mặc định 1), `limit` (mặc định 20, tối đa 100), `from`, `to` (YYYY-MM-DD), `coupleId?`. Sổ chi thêm `sharedWalletId`; công nợ thêm `status:pending|pending_confirm|paid`. Khoảng ngày bao gồm cả ngày kết thúc, theo timezone hồ sơ: đóng góp/khoản chi lọc ngày ghi nhận, settlements lọc ngày tạo khoản nợ. Mục tiêu và quỹ trả danh sách đầy đủ theo context.

Xóa chi có nợ đã xác nhận hoặc đang chờ xác nhận trả 409. Chi từ quỹ thiếu tiền không ghi bất kỳ phần nào. Ghi nhận đóng góp/thanh toán không chuyển tiền thật và không tự trừ ví cá nhân. Xem Swagger tại `/api/docs` để có DTO và schema đầy đủ.
