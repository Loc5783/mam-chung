# API giai đoạn 1–10

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

Các API nghiệp vụ đã triển khai được mô tả trong các mục bên dưới. Các tiện ích health/docs/OpenAPI được công khai để vận hành.

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

## Giai đoạn 6 — Công việc

Mọi endpoint có tiền tố `/api` và cần đăng nhập. Task cá nhân chỉ creator được đọc/sửa/xóa; task chung cho cả hai thành viên. Couple archived chỉ đọc qua quyền thành viên cũ, mọi write bị chặn trong transaction.

| Endpoint                 | Nội dung                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| GET /tasks               | Danh sách phân trang, bộ lọc bên dưới                                                              |
| POST /tasks              | `{title,scope?,description?,deadline?,priority?,assignedTo?,kind?,labels?,checklist?,recurrence?}` |
| GET /tasks/:id           | Chi tiết và `revision`, `readOnly`; không có quyền trả 404                                         |
| PUT /tasks/:id           | Các trường sửa được như tạo, trừ scope; bắt buộc `revision`                                        |
| DELETE /tasks/:id        | Body `{revision}`; soft delete, giữ bản lặp kế tiếp và bình luận                                   |
| PATCH /tasks/:id/status  | `{status,revision}`; DONE ghi completedAt và tạo một bản kế tiếp nếu lặp                           |
| GET /tasks/:id/comments  | Bình luận việc chung, `page`, `limit`; cả archived được đọc                                        |
| POST /tasks/:id/comments | `{text}` 1–500 ký tự, chỉ shared active                                                            |
| GET /tasks/members       | Tên/id dùng phân công, `coupleId?` để xem snapshot archived; không trả email                       |

`scope`: `personal` (mặc định khi tạo), `shared`; `coupleId=null` cho việc riêng. List `scope=all|personal|shared|mine` (mặc định all); mine chỉ `assignedTo` là người xem. Không chuyển scope khi sửa. Shared lấy couple active từ server, không nhận coupleId tùy ý trong body. `assignedTo` có thể null, personal chỉ self, shared phải là thành viên active. `kind=task|shopping`; shopping dùng checklist tick từng món.

`priority=LOW|MEDIUM|HIGH|URGENT`; `status=TODO|IN_PROGRESS|DONE|CANCELLED`. Checklist tối đa 100 dòng `{id?:UUID,text,done?}`, server sinh id nếu thiếu; id không trùng. Labels tối đa 10 nhãn, mỗi nhãn 30 ký tự. `deadline` là YYYY-MM-DD hoặc null, `recurrence=none|daily|weekly|monthly`; lặp cần deadline. Tiêu đề tối đa 160, mô tả 2.000 ký tự.

List: `page=1`, `limit=20` (tối đa100), `status`, `priority`, `kind`, `label`, `search` (tiêu đề/mô tả/nhãn, literal không phải regex), `from`, `to` (bao gồm hai ngày), `due=today|overdue`, `sort=deadline|priority|newest|oldest`. Hôm nay/quá hạn theo timezone hồ sơ, bỏ DONE/CANCELLED và việc không hạn. `coupleId` trong list chỉ dành cho người từng tham gia; tách toàn bộ việc riêng và hành trình mới. Trả `{items,total,page,limit,readOnly}`.

Revision cũ trả 409 TASK_CHANGED; cần tải lại trước khi sửa, không tự ghi đè. Đổi sang DONE sinh một bản TODO kế tiếp cùng phạm vi/người được giao/nhãn, checklist bỏ tick, không sao chép bình luận. Ngày kế tiếp dựa trên deadline cũ, không nhảy theo ngày bấm; tháng ngắn clamp và giữ anchor để trở lại ngày gốc. Mở lại/hoàn thành lại việc cũ không sinh trùng, kể cả bản kế tiếp đã bị xóa. Xóa việc gốc không xóa bản kế tiếp. Sửa ngày/chu kỳ việc gốc sau khi đã tạo kế tiếp không tự sửa bản đã tạo.

## Fitness cá nhân (giai đoạn 7)

Toàn bộ endpoint dưới đây có prefix `/api`, cần access token. Các tài nguyên tập luyện luôn theo userId từ phiên đăng nhập, không nhận quyền qua Couple hoặc userId/coupleId trong body. ID không thuộc bạn trả404. Tất cả body/query strict Zod; ngày YYYY-MM-DD có kiểm tra ngày lịch thật.

| Endpoint                          | Dữ liệu / kết quả                                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET /exercises                    | `{items}` gồm 11 bài hệ thống và bài riêng; `search`, `muscleGroup`                                                               |
| POST /exercises                   | `{name,muscleGroup}`; tạo bài riêng,201                                                                                           |
| PUT /exercises/:id                | Tên/nhóm cơ optional; chỉ bài riêng                                                                                               |
| DELETE /exercises/:id             | Chỉ bài riêng chưa được set/mẫu sử dụng;204; bài đã dùng409                                                                       |
| GET /workout-sessions             | `{items,total,page,limit}`; `page=1,limit=20`, tối đa100; `from,to` inclusive                                                     |
| POST /workout-sessions            | `{date,durationMinutes,notes?,startTime?,endTime?,mood?,bodyWeight?}`;201                                                         |
| GET /workout-sessions/:id         | Buổi và các set chưa xóa, tổng volume                                                                                             |
| PUT /workout-sessions/:id         | Các trường buổi optional + `revision` bắt buộc                                                                                    |
| DELETE /workout-sessions/:id      | `{revision}`; xóa mềm buổi và set atomic;204                                                                                      |
| POST /workout-sets                | `{sessionId,exerciseId,weight,reps,setNumber?,done?,setType?,rpe?}`;201                                                           |
| PUT /workout-sets/:id             | Trường set optional + `revision`; không chuyển sang buổi khác                                                                     |
| DELETE /workout-sets/:id          | `{revision}`;204                                                                                                                  |
| GET /workout-templates            | `{items}` mẫu riêng                                                                                                               |
| POST /workout-templates           | `{name,notes?,items:[{exerciseId,weight,reps,setType?,rpe?}]}`;1–100 set;201                                                      |
| PUT /workout-templates/:id        | Toàn bộ mẫu + `revision`                                                                                                          |
| DELETE /workout-templates/:id     | `{revision}`; giữ buổi đã tạo từ mẫu;204                                                                                          |
| POST /workout-templates/:id/start | Body như tạo buổi; tạo buổi+set atomic, mọi set `done=false`;201                                                                  |
| GET /body-metrics                 | Phân trang như buổi, `from,to` inclusive                                                                                          |
| POST /body-metrics                | `{date,weight?,waist?,chest?,hips?,arm?,thigh?,notes?}`; ít nhất một số đo khác null;201                                          |
| PUT /body-metrics/:id             | Thay thế số đo với `date` + `revision`; không merge số đo bỏ trống                                                                |
| DELETE /body-metrics/:id          | `{revision}`;204                                                                                                                  |
| GET /fitness/goal                 | `{sessionsPerWeek}` mặc định4                                                                                                     |
| PUT /fitness/goal                 | `{sessionsPerWeek:1..14}`                                                                                                         |
| GET /fitness/last/:exerciseId     | `{date,sessionId,sets}` của buổi gần nhất có set hoàn thành bài này đến hôm nay; không có thì null/null/[]                        |
| GET /fitness/stats                | Báo cáo đầy đủ: stats, volume, repDistribution, progress, prs, bests, comparison, weeklyGoal, body, latest, continueFrom, from/to |
| GET /fitness/volume               | `{items,from,to}` với `{sessionId,date,volume}`                                                                                   |
| GET /fitness/rep-distribution     | `{items,from,to}` với name,range,count,percent                                                                                    |
| GET /fitness/progress/:exerciseId | `{items,from,to}` với maxWeight,oneRM theo buổi; null nếu không có set đủ điều kiện                                               |
| GET /fitness/prs                  | `{items,from,to}` với baseline,flags.weight/volume/oneRM                                                                          |

Các endpoint báo cáo nhận `range=7d|30d|90d` (mặc định30d), `exerciseId?`, `from?,to?`. Ngày mặc định theo timezone hồ sơ và gồm hôm nay; from/to riêng override biên tương ứng. Bộ lọc bài chỉ áp dụng volume/rep/PR/progress; số buổi/thời gian vẫn đếm tất cả buổi trong khoảng. `lastVolume` là volume của buổi gần nhất đến hôm nay, áp dụng bộ lọc bài, độc lập khoảng chọn. Week/month, so sánh và mục tiêu theo tuần lịch hiện tại, tuần bắt đầu thứ Hai; không đếm buổi ngày tương lai vào tuần/tháng hiện tại. Frequency = số buổi trong khoảng / số ngày inclusive ×7.

Chỉ set done tính volume, rep và PR. Warmup vẫn tính volume/rep, loại khỏi PR/1RM. PR volume là tổng các set không khởi động đã hoàn thành của một bài trong một buổi. Epley = kg ×(1+rep/30), chỉ là ước tính. PR được so theo lịch sử trước khoảng, bản đầu là baseline; chỉnh/xóa sẽ tính lại. bests lấy lịch sử đến `to`, không để ngày tương lai ngoài khoảng ảnh hưởng kỷ lục. Không gộp tiến triển của nhiều bài lên một đường kg trong UI.

Buổi: duration>0 đến1440 phút; nếu đủ ISO giờ start/end, server tính duration (2 chữ số thập phân), end phải sau start, tối đa24h và không cho kết quả làm tròn0. Mood1–5; bodyWeight>0 đến500kg. Set: weight0–1000kg (0 cho bài không tải ngoài), reps nguyên1–1000, done mặc địnhtrue, setType warmup/working/dropset/failure, RPE1–10 bước0,5 hoặc null. Số set tự cấp theo bài/buổi, không trùng; setNumber tối đa10000. Số đo body: weight>0 đến500kg, các số đo>0 đến300cm; một bản chưa xóa/ngày/người, trùng trả409.

Revision cũ trả409 FITNESS_CHANGED; mở lại biểu mẫu trước khi sửa. Các ghi sử dụng transaction và khóa người dùng để set không được tạo sau khi buổi xóa; rollback giữ nguyên cả buổi/set. Tên bài trên set là snapshot. Cân nặng trong buổi không tự tạo body metric. API không cung cấp chương trình tập hoặc tư vấn sức khỏe.

`continueFrom` trả buổi gần nhất có set hoàn thành đến hôm nay để gợi ý bài/kg/rep; `latest` vẫn là buổi ghi gần nhất kể cả chưa hoàn thành.

## Giai đoạn 8 — Dashboard và thông báo

| Method/path                   | Nội dung                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /dashboard                | Một response gồm generatedAt, finance, budgets, tasks.today/overdue (5 việc mỗi nhóm), fitness (7 ngày), couple/shared/activity (5 hoạt động) hoặc null khi không có cặp active. Không nhận query.      |
| GET /notifications            | page/limit mặc định1/20, limit≤100; unread=true/false, type theo enum. items/total/unreadCount/page/limit. unreadCount là tổng chưa đọc còn hiệu lực của người dùng, không phụ thuộc bộ lọc hoặc trang. |
| PATCH /notifications/:id/read | Body `{}` và query trống. Chỉ thông báo còn hiệu lực của chính người gọi; gọi lại giữ readAt. ID không thuộc tài khoản hoặc đã hết hiệu lực trả404.                                                     |
| POST /notifications/read-all  | Body `{}` và query trống. Trả `{updated}`; chỉ đánh dấu những thông báo active chưa đọc của người gọi.                                                                                                  |

Các đường dẫn trên có tiền tố `/api`, cần bearer token. JSON/query Zod strict; ID ObjectId; không nhận userId/coupleId/readAt từ client. OpenAPI0.9.0 có schema đầy đủ và security. Payload thông báo chỉ sourceId; không trả eventKey, owner ID khác, hash hoặc mã mời.

Bảy type: COUPLE_INVITE, INVITE_ACCEPTED, DEBT_NEW, PAYMENT_CONFIRM, TASK_ASSIGNED, TASK_DUE, BUDGET_EXCEEDED. Thông báo đồng bộ khi đọc danh sách/đọc một/đọc tất cả, trong transaction khóa tài khoản. Unique(userId,eventKey) chống bản sao; readAt giữ khi nội dung sửa cùng điều kiện. Việc giao lại dùng assignmentVersion nội bộ, hạn thay đổi dùng deadline, yêu cầu thanh toán lại dùng markedAt để phân biệt lượt mới. Nhắc hạn tính ngày hồ sơ: quá hạn, hôm nay và ngày mai; chỉ người phụ trách (assignedTo hoặc creator khi chưa giao), không gồm DONE/CANCELLED. Ngân sách so chi cá nhân tháng hiện tại với amount, đạt100% trở lên; thu/chuyển tiền/số dư ban đầu không tính chi.

Công nợ pending/pending_confirm nhắc hai bên; PAYMENT_CONFIRM chỉ người nhận tiền. Thanh toán xong/xóa nguồn, hoàn thành/xóa việc, điều chỉnh chi xuống dưới ngân sách, thu hồi/hết hạn mời hoặc lưu trữ Couple làm nhắc cũ inactive và ẩn. Nếu điều kiện trở lại sau một lần đồng bộ đã thấy nó ngừng, thông báo được kích hoạt lại và chưa đọc. Không có worker/push/email/SMS: điều kiện xuất hiện rồi kết thúc giữa các lần đồng bộ không được ghi như lịch sử thông báo.

Mã mời không có email người nhận: creator có nhắc đang chờ; người khác chỉ có COUPLE_INVITE sau GET /couples/invite/:code hợp lệ. Lưu receipt gồm userId/inviteId trong transaction; không plaintext code, không tự chấp nhận. Link thông báo mở `/couple`, người nhận nhập lại mã đã được người mời chia sẻ. Khi chấp nhận, hai bên có INVITE_ACCEPTED.

Dashboard dùng các dịch vụ phân quyền hiện có, không chuyển dữ liệu cá nhân partner sang người gọi. Các phần được đọc tuần tự, không phải snapshot nguyên tử xuyên mô-đun. Kiểm tra lại cặp active trước trả phần chung; lỗi thật được trả cho client, không thay bằng số0 giả. Cache UI theo user; mutation làm mới Dashboard/thông báo, poll15 giây và focus. Đổi timezone làm mới cả hai để hạn việc và tháng đúng hồ sơ.

## Hoàn thiện Swagger (giai đoạn 9)

OpenAPI3.0.3, phiên bản1.0.0; 84 đường dẫn và118 schemas ở bản local đã kiểm tra. Mọi reference schema đều tồn tại. Các path thống nhất tiền tố `/api`, đã đối chiếu122 thao tác nghiệp vụ để tránh Swagger gọi sai địa chỉ. Các mô-đun request/response, phân trang, tham số và Bearer auth được giữ cùng Swagger dùng thật tại `/api/docs`. Đây là số path duy nhất, không phải số thao tác HTTP.

`GET /api/health` trả `{status,database,phase,development}`; phase9, development chỉ true khi NODE_ENV=development. HTTP200 khi MongoDB kết nối;503 khi chưa sẵn sàng. Seed local kiểm tra trường development trước đăng nhập/tạo dữ liệu để từ chối API test/production. Health không tiết lộ URI hoặc secret.

PWA không thay đổi contract API và không cache response API. Mọi mutation vẫn cần mạng và kiểm tra quyền/revision/transaction như các giai đoạn trước. Logout trả204 không có JSON body.
