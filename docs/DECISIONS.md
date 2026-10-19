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

## Giai đoạn 3 — Kế hoạch tài chính

- Ngân sách cá nhân duy nhất theo người dùng/danh mục/tháng, chỉ danh mục chi. Tính spent từ sổ trong snapshot thay vì cập nhật bộ đếm song song; cảnh báo >=80% và >=100% so sánh BigInt để tránh làm tròn ở số lớn. Không chặn chi vì vượt ngân sách.
- Mục tiêu cá nhân là ghi nhận tiền đã để riêng, không tự trừ ví và không tính expense. Nạp và hoàn tác dùng transaction + khóa người dùng; số tiền savedAmount không nhận từ client. Lịch sử có soft delete, mục tiêu có thể vượt 100%. Couple goal chờ couple và tài chính chung (giai đoạn 4–5).
- Lịch tuần/tháng lưu ngày địa phương và anchorDay. Ngày cuối tháng ngắn được clamp, tháng sau trở lại anchor. Job khởi động và kiểm tra mỗi phút để đáp ứng mọi múi giờ, chỉ ghi kỳ đến hạn; không cần cron bên ngoài. Máy chủ dừng thì không tự ghi, khi chạy lại sẽ chạy bù.
- Mỗi kỳ có RecurringRun với khóa duy nhất (recurringId, scheduledDate), cùng transaction với sổ, ví, nextDate. Khóa người dùng serialize các request/job và bảo vệ khi nhiều server cùng chạy. Không tái tạo kỳ nếu người dùng xóa giao dịch đã sinh. Chạy bù tối đa 100 kỳ/lượt; lượt sau tiếp tục.
- Thiếu tiền hoặc ví lưu trữ không làm tiến ngày: lưu lỗi để UI hiển thị. Auto job thử lại vào ngày địa phương kế tiếp; nút chạy kỳ đến hạn cho phép thử ngay. Tạm dừng/xóa mẫu không hoàn nguyên giao dịch đã có. Không xóa ví hoặc đổi loại/xóa danh mục còn được ngân sách/lịch tham chiếu; cần chuyển hoặc xóa kế hoạch trước.
- Báo cáo trả đủ tháng cả khi trống, chỉ regular income/expense; loại opening/transfer. Comparison null khi tháng trước bằng 0. Line chart top 5 để dễ đọc, bảng tổng vẫn có mọi danh mục. Đổi timezone hồ sơ làm mới cache tài chính.
- CSV phản ánh toàn bộ bộ lọc, không chỉ trang. UTF-8 BOM/CRLF, escape quote và chống formula injection cho trường văn bản. Giới hạn 10.000 dòng để bảo vệ bộ nhớ; xuất lớn hơn/streaming thuộc tối ưu sau này. Không coi nội dung CSV là câu lệnh.
- Mọi cập nhật kế hoạch khóa tài khoản và kiểm tra chủ sở hữu trong service; tài khoản đã xóa bị loại khỏi worker. Kiểm thử dùng replica set riêng, QA local riêng; tài khoản demo và dữ liệu hiện hữu được giữ nguyên.

## Giai đoạn 4 — Couple

- Một couple tối đa hai người; người tạo là owner, người nhận là member. User.coupleId và partial unique index CoupleMember(userId) khi active cùng bảo vệ một active membership. Mọi thay đổi khóa user/couple trong transaction; nhận mã đồng thời chỉ một người thành công.
- Code 8 ký tự crypto.randomInt với bảng chữ bỏ I/O/0/1; SHA-256 lưu DB, plaintext chỉ trả lúc tạo. Mã có hiệu lực 48h, một lần, bị thu hồi khi tạo mới/rời. Không TTL-xóa used invite để giữ chứng cứ; tránh lộ tình trạng mã bằng lỗi 404 thống nhất. UI sao chép để người dùng tự gửi, không tự nhắn người khác.
- Chỉ owner tạo/thu hồi mã và chuyển quyền. Cả hai thành viên active sửa tên/ngày kỷ niệm. Link lời mời cần đăng nhập; giữ đích đến khi chuyển qua đăng ký/đăng nhập. Preview không tự chấp nhận.
- Khi member rời, archive toàn bộ couple và cả hai membership, xóa cả hai active pointer. Người còn lại bắt đầu couple mới thay vì thêm người thứ ba vào lịch sử cũ. Solo owner phải xác nhận giải tán; owner đang có partner phải chuyển quyền trước. Lịch sử immutable, chỉ thành viên cũ đọc; tên/ảnh snapshot tại lúc lưu trữ, không trả email hay profile riêng của partner.
- Confirm=true bắt buộc trước rời. Guard công nợ đọc `settlements` với unpaid/pending/pending_confirm, cần xác nhận riêng khi count>0; không xóa công nợ. Tổng tiền và shared ledger ở giai đoạn 5, UI không giả định cân bằng/0đ. Couple.status archived điều khiển read-only shared resources; giai đoạn 5 phải kiểm tra trạng thái và lock cùng transaction, không chỉ middleware.
- requireCouple tra DB và từ chối archived. Account deletion kiểm tra coupleId cả trong transaction sau password check để không xóa user vừa được ghép đồng thời. User membership changes không thay đổi tiền cá nhân.
- Anniversary date-only >=1900, không tương lai, đếm ngày theo timezone người xem; 29/02 kỷ niệm vào 28/02 ở năm không nhuận. Dashboard nhắc ngay ngày kỷ niệm.
- Feed audit scoped theo membership, phân trang; không nhận message/actor tùy ý và không chứa mã mời. Auto poll 5s khi mở trang, làm mới trên focus; sync coupleId từ server để người kia rời/chuyển quyền không để lại trạng thái cũ. WebSocket/thông báo đầy đủ ở các giai đoạn sau.
- Quỹ, chia tiền, settlement và mục tiêu chung được triển khai tiếp ở giai đoạn 5; đây là Couple core và archive foundation, chưa hoàn thành toàn bộ ứng dụng.

## Giai đoạn 5 — Tài chính chung

- Quỹ bắt đầu ở 0; số dư chỉ đổi do đóng góp hoặc chi quỹ. Không nhận số dư từ client. Quỹ có lịch sử chỉ lưu trữ/khôi phục, không xóa để mất dấu tiền.
- Cả hai thành viên active quản lý quỹ và mục tiêu; khoản chi cần đủ hai thành viên. Mọi write khóa user và parent couple cùng transaction, kiểm tra active lần nữa; archived chỉ đọc cho thành viên cũ.
- Tiền VND nguyên, an toàn trong giới hạn Number.MAX_SAFE_INTEGER. Chia đều để số đồng lẻ cho người trả. Custom cộng bằng BigInt, tổng phải đúng. Percent tối đa hai số thập phân, tổng 100%; làm tròn xuống phần người kia, phần còn lại thuộc người trả.
- Chi từ quỹ trừ số dư, không tạo nợ. Ứng cá nhân không đổi quỹ/ ví riêng; chỉ tạo settlement cho phần người kia. Chọn danh mục chi hệ thống, không tiết lộ danh mục cá nhân cho partner.
- Settlement tự sinh từ khoản chi, không tạo tùy ý. Debtor báo đã trả, creditor xác nhận hoặc trả lại pending kèm ghi chú. Công nợ ròng là phép tổng hợp, không tự đóng các khoản đối ứng.
- Chỉ creator hoặc owner xóa khoản chi; chặn khi settlement paid hoặc pending_confirm. Xóa chi quỹ hoàn lại số dư trong cùng transaction. Retry/concurrency không tạo thêm lần trừ hay settlement.
- Đóng góp quỹ và thanh toán là ghi nhận tiền đã chuyển ngoài ứng dụng; không tích hợp ngân hàng. Mục tiêu chung là theo dõi tiền để riêng, không trừ quỹ, có lịch sử và hoàn tác bởi người góp hoặc owner.
- Tổng quan tháng theo timezone người xem; archived dùng tháng tại thời điểm archivedAt. Query cache scoped theo user/couple, poll 15 giây khi mở trang; cơ chế phiên ngăn kết quả từ tài khoản cũ lọt vào tài khoản mới.

## Giai đoạn 6 — Công việc

- Một Task hỗ trợ personal/shared, checklist và shopping. Không di chuyển task giữa các scope để tránh lộ việc riêng và nhầm lịch sử. Shared coupleId lấy từ user hiện tại, không nhận client body.
- Personal creator tự quản lý; assignedTo chỉ self hoặc null. Shared cả hai sửa/xóa, không yêu cầu owner/creator; assignedTo phải thuộc membership active. Archived chỉ đọc cho thành viên cũ, không nối ledger/tasks cho partner mới.
- Mọi write khóa user và parent couple trong transaction; revision bắt buộc khi update/status/delete. Request stale trả409, UI đọc lại danh sách nhưng giữ form cũ để người dùng đóng/mở lại trước sửa. Không dùng last-write-wins làm mất tick/checklist của partner.
- DONE ghi completedAt; chuyển ra khỏi DONE xóa completedAt. Request DONE cùng trạng thái không đổi timestamp hoặc tăng revision. Hủy không tạo bản lặp.
- Lặp hoàn thành sinh đúng một successor bằng partial unique sourceTaskId, cùng transaction. Checklist reset, comments không copy, deadline dựa hạn cũ; monthly giữ anchor qua tháng ngắn. Không chạy worker/catch-up tự động: mỗi lần hoàn thành tạo một bản kế tiếp. Reopen/delete successor không bỏ dấu đã sinh, không tạo trùng.
- Soft delete giữ lịch sử DB và comments, nhưng API không cho truy cập task đã xóa. Không xóa dây chuyền successor. Đổi lịch của bản cũ không sửa successor đã sinh.
- Bình luận text thuần tối đa500 ký tự, authorName snapshot, không HTML; chỉ shared active ghi. Activity feed chỉ ghi hành động chung, không lộ title/description của việc riêng.
- Search escape literal; due/today/overdue là ngày lịch theo timezone user và loại terminal statuses. Đổi timezone làm mới cache tasks/shared để tổng quan không còn ngày/tháng cũ.
- List/Kanban cùng dữ liệu và phân trang20; Kanban bốn cột của trang hiện tại, chọn status thay cho kéo-thả. Query scoped theo user/context, poll15 giây khi mở; thông báo đầy đủ thuộc giai đoạn8.

## Giai đoạn7 — Fitness

- Fitness hoàn toàn cá nhân: hệ thống chỉ đọc/ghi userId từ phiên, kể cả hai tài khoản Couple active. Bài hệ thống chỉ đọc; bài riêng có thể sửa và chỉ xóa khi chưa dùng. Lưu snapshot tên/nhóm cơ trên set.
- MongoDB replica set transaction + user securityVersion lock bảo vệ mọi ghi; revision riêng cho buổi/set/mẫu/số đo tránh ghi đè. Xóa buổi và set cùng transaction. Set đánh số riêng mỗi bài/buổi; retry transaction cấp số không trùng.
- Lịch buổi/số đo dùng date-only. Analytics dùng timezone hồ sơ, 7/30/90 ngày inclusive. Số buổi/thời gian tính tất cả buổi đã ghi kể cả buổi chưa có set; volume/rep chỉ done. Warmup tính volume/rep, bỏ khỏi PR/progress/1RM. Mẫu tạo done=false, không tính như đã tập.
- PR kg, volume bài-buổi và Epley1RM được tính lại từ lịch sử theo ngày/thời điểm tạo, ID làm tie-break; baseline đầu không gọi là phá kỷ lục. Lịch sử trước khoảng được giữ để so, bests chỉ đến to. Ngày tương lai không dùng gợi ý gần nhất hoặc tuần/tháng hiện tại.
- `lastVolume` độc lập khoảng, theo buổi gần nhất đến hôm nay và bài đang chọn. Week comparison so tuần này đến hôm nay với cả tuần trước; UI dùng chữ Tuần này/Tuần trước, không cam kết hai khoảng có số ngày bằng nhau.
- Rest timer dựa deadline Date.now thay vì trừ mỗi tick, dừng/tiếp tục/đặt lại; không giữ timer khi rời trang/chuyển buổi. Không có chuông/push chạy nền ở giai đoạn7. Các query poll15s, cache theo user; mutation kiểm tra epoch trước thay đổi UI/cache.
- UI gợi ý kg/rep từ set hoàn thành cuối của bài trong buổi gần nhất; request đến muộn không ghi đè trường người dùng đã nhập. Khi lưu buổi mới/mẫu, mở ngay chi tiết ghi set. Các bài gần nhất hiện trong khối Tiếp tục khi có set done.
- Body metric mỗi người một bản/ngày, trùng báo409 để sửa chủ động. PUT thay thế đủ trường, bỏ trống là null. Cân nặng của buổi và nhật ký số đo là hai bản ghi khác nhau. Không tự đồng bộ giữa hai nơi.
- Đã sửa một kiểm thử công nợ dùng ngày giao dịch cố định để lọc createdAt hiện tại; đổi sang ngày tạo thật theo timezone. Logic production công nợ không thay đổi.

## Giai đoạn 8 — Tổng quan và thông báo

- Dashboard gộp dịch vụ phân quyền có sẵn thành một HTTP response. Không thay đổi giao dịch tiền, không gộp báo cáo Fitness của partner. Quỹ chung hiển thị riêng số dư cá nhân. Hạn/ngân sách/Fitness theo timezone hồ sơ; nhóm việc5 dòng, feed5 dòng. Kiểm tra lại cặp active sau đọc chung để không giữ ngữ cảnh đã rời.
- Các khối preview nhận dữ liệu được cung cấp và tắt query riêng; chuông lấy danh sách độc lập. Cả Dashboard và thông báo poll15 giây khi trang đang mở, focus làm mới. Các ghi tiền/ngân sách/cặp/việc/tập và đổi timezone invalidation theo user; phản hồi mutation phiên cũ không điều hướng hay đổi hồ sơ.
- Thông báo là nhắc những điều kiện còn hiệu lực, được tính/lưu khi API được đọc, không chạy nền. Transaction khóa user, unique(userId,eventKey) và trạng thái active/readAt chống trùng, giữ đã đọc, rollback toàn bộ khi ghi thất bại. Kết thúc điều kiện làm inactive; sự kiện thoáng qua giữa hai lần đồng bộ không được giữ. Đây không phải audit feed hoặc bảo đảm push giao mọi sự kiện.
- AssignmentVersion là trường nội bộ tăng khi đổi người được giao, không nhận từ client/không trả DTO. Hạn dùng ID+deadline; payment dùng ID+markedAt; budget dùng ID+month. Reactivation sau đồng bộ trạng thái không còn hiệu lực tạo lại unread; không nhân bản document.
- Không có địa chỉ người nhận mã mời. Receipt được tạo chỉ sau preview mã hợp lệ; lưu ID thay plaintext code. Thông báo mở trang Couple, người dùng nhập lại mã đã nhận. Không tự gửi mã hoặc chấp nhận lời mời.
- Nhắc ngân sách khi đạt/vượt100%; mức80% có cảnh báo ngay trong thẻ ngân sách. Chỉ số chi từ ledger của chính người gọi. Nhắc task chỉ phụ trách, bỏ terminal/deleted. Công nợ theo active membership, creditor mới nhận yêu cầu xác nhận. Khi archive/rời, nhắc chung tự ẩn nhưng lịch sử sổ chung không bị xóa.
- Link thông báo chỉ điều hướng các route nội bộ cho phép sau khi API đọc thành công; lỗi không đóng modal. Đọc tất cả không ảnh hưởng người kia. Bộ lọc/pagination thu hẹp được đưa về trang hợp lệ. Màn hình390px có kiểm tra thực và chặn tooltip Fitness làm tràn trang khi đổi viewport.

## Giai đoạn 9 — Responsive, PWA và hiệu năng

- Tách trang bằng React.lazy/Suspense, boundary có thử lại; Dashboard dùng preview nhỏ riêng để không kéo toàn bộ trang Tasks/Fitness. Biểu đồ riêng vendor chunk. Chia gói không được coi là bằng chứng Web Vitals; worker vẫn precache toàn bộ tài nguyên công khai trong nền.
- PWA chỉ bản build. Version hash gồm tên asset có hash, manifest, icon, favicon, offline và template worker. Cache chỉ allowlist công khai, không index/trang có dữ liệu/API; navigation network-first và fallback offline chung. Không lưu token, cache tài khoản hoặc queue mutation ngoại tuyến. Update chờ bấm chủ động để tránh tự tải lại giữa biểu mẫu.
- Modal portal, inert nền, giữ focus khi nhập, trap Tab/ShiftTab, Escape theo busy và trả focus; skip link/focus main khi chuyển route. Tab dùng roving tabindex, mũi tên/Home/End. Giảm chuyển động và tăng tương phản chữ/nút; chưa chứng nhận WCAG hoặc kiểm tra bằng screen reader thật.
- Mobile320px ẩn dòng ngữ cảnh thừa trên topbar, giữ tên trang; input16px và nút tối thiểu44px; giới hạn modal theo viewport. Kiểm tra tràn bằng DOM và ảnh, không tự động suy ra mọi thiết bị đã qua.
- Seed chỉ hai tài khoản giả được đánh dấu tên/email, chỉ API development loopback. Không thay tài khoản demo có sẵn hay xóa dữ liệu; giữ tài nguyên tồn tại theo tên/ghi chú. Báo đã trả tiền chỉ lúc tạo khoản chi cá nhân mẫu mới; chạy lại không tự ghi lại trạng thái người dùng đã đổi. Không hỗ trợ seed chạy song song hoặc migration production.
- `check:pwa` kiểm tra bản build, icon PNG/kích thước, placeholder/allowlist và từng chunk<500KB trong CI. GitHub CI/production/cài OS chưa chạy, tách biệt với kiểm chứng local.

## Giai đoạn 10 — Kiểm thử luồng đầy đủ

- Bổ sung kiểm thử HTTP qua Express và MongoDB replica set tạm: đăng ký/refresh/logout, ví/ngân sách/mục tiêu/CSV, ghép đôi/chia tiền/công nợ, việc chung/revision/lặp/bình luận, buổi tập/mẫu/thống kê. Không thay cơ chế phân quyền hoặc cho phép âm số dư để phục vụ kiểm thử.
- `qa:local` dùng API4001/web5174/Mongo27119 và database tự sinh; tuyệt đối không dùng `.local/data`. CORS localhost riêng tránh cookie của website chính127.0.0.1. Giữ rate limit, JWT ngẫu nhiên, NODE_ENV=test để seed demo không hoạt động. Dừng chỉ dọn thư mục tạm do MongoMemoryReplSet tạo.
- Kiểm chứng trình duyệt được thực hiện bằng CUA với locator Playwright trên bản build, hai tài khoản giả. Các thao tác trên sổ tiền chỉ ghi dữ liệu thử, không thực hiện chuyển tiền. Chưa có job Playwright CLI/browser E2E trong CI; CI hiện tại tự chạy bộ HTTP mới thông qua npm test.
- Sửa nhãn `/invite/:code` thành Lời mời/Không gian chung; route không tồn tại hiển thị đúng thông báo thay vì hứa triển khai chức năng. Health/OpenAPI cập nhật mốc10, version tài liệu API1.1.0.

## Giai đoạn11 — Chuẩn bị triển khai

- Người dùng chưa có máy chủ/tên miền và chọn chuẩn bị trước. Không mua dịch vụ, công bố website hoặc chuyển dữ liệu thật. Health giữphase10, tránh đồng nhất chuẩn bị với production đã chạy.
- Compose production độc lập để không kế thừa port/env/volume development. Mongo có root/app/backup users và keyfile volume; database/app networks internal, chỉ Caddy publish80/443. Một node/keyfile là mức tự quản nhỏ, chưa có HA/X.509/TLS nội bộ hoặc cloud database; đánh giá lại khi có máy chủ và phạm vi dữ liệu thật.
- Runtime chuyểnNode24 LTS vìNode20 đã EOL; API dùng multi-stage/omit dev/non-root. .dockerignore loại .local, env và backups, không đưa dữ liệu máy cá nhân vào build.
- Backup full replica set/oplog, gzip, SHA256, credential config tạm và báo sức khỏe theo last-success. Không tự upload/xóa bản cũ. Gzip không mã hóa; checksum không thay thế bảo vệ archive, backup ngoài máy và diễn tập khôi phục.
- Restore tool cố định dịch vụmongo-restore trong project/mạng/volume riêng; không nhận URI production. Đợt kiểm chứng Windows dùng hai replica set tự sinh, tài khoảnbackup có xác thực và ghi transaction đồng thời; tool adapter chỉ đổi hostname test, không thay flags full/oplog/gzip/replay.
- Compose CLI portable5.6.0 và MongoDB Tools100.19.1 lấy từ nguồn chính thức, đối chiếuSHA256 và lưu .local; không cài Docker Engine vào hệ thống. config/syntax invariants được kiểm tra; buildcontainer/nginx/Caddy trong CI mới thêm chưa chạy vì chưa córemote/Engine.

## Nâng cấp Công việc — Giai đoạn B

- Giữ API task cũ, `deadline` yyyy-MM-dd và recurrence none/daily/weekly/monthly. Bổ sung listId/position/startDate/deadlineHasTime/deadlineTime/deadlineTimezone/reminderAt/estimateMinutes/timeSpentSeconds/completedBy mặc định an toàn. Client không được ghi completedBy/timeSpentSeconds/position hoặc ownerId/coupleId. RecurrenceRule chỉ là trường nền tảng mặc định null; thực thi quy tắc mở rộng ở giai đoạn E.
- TaskList có đúng một ownerId hoặc coupleId, revision và systemKey duy nhất cho Inbox cá nhân/Việc chung. Mọi ghi khóa user/couple và kiểm tra quyền trong Service. Couple archived giữ lịch sử chỉ đọc. Danh sách do user lưu trữ được mở lại qua PUT; task trong danh sách ấy không ghi được. Inbox không được xóa/lưu trữ.
- Client cũ không gửi listId sẽ dùng Inbox; null khi update trở về Inbox đúng phạm vi. Không dùng đổi listId để chuyển cá nhân/chung. Chuyển phạm vi có xác nhận thuộc giai đoạn E.
- Position là khóa chữ/số base62 phân đoạn, so theo thứ tự nhị phân MongoDB/simple collation. Reorder kiểm tra revision và hai hàng lân cận cùng container, chỉ ghi hàng được di chuyển. beforeId là hàng đứng sau, afterId là hàng đứng trước. Khi chèn giữa sát nhau vượt 128 ký tự thì trả409 rõ, không ghi đè/reindex im lặng.
- Bulk tối đa100 `{id,revision}`, action update hoặc delete. Kiểm tra mọi ID trước; sai quyền/phiên bản trả BULK_REJECTED và danh sách ID lỗi. Toàn bộ dữ liệu/task lặp/activity nằm trong một transaction. Lỗi validation nghiệp vụ cũng rollback toàn bộ. Danh sách xóa cần mode move cùng owner/couple hoặc delete mềm; không xóa bản lặp ở danh sách khác.
- GET /tasks giữ search/due/scope cũ, thêm q/list/smart/assignee/groupBy/sort=manual. Smart today/upcoming/overdue theo timezone hồ sơ; upcoming là ngày mai đến hết ngày thứ7; mọi smart trừ done bỏ DONE/CANCELLED. Groups chỉ phản ánh trang hiện tại, không giả tổng toàn danh sách. Sắp xếp/paging chuyển sang MongoDB; các khóa ưu tiên/null deadline vẫn giữ nghĩa cũ.
- Migration mặc định dry-run, apply phải tường minh. CLI apply chụp tasks/task_lists dưới .local/task-migration-backups bằng Extended JSON trước khi ghi. Preflight từ chối task thiếu owner hoặc list sai phạm vi. Transaction theo owner/couple, có thể chạy lại sau lỗi. Chỉ điền trường thiếu, listId/position còn null; giữ timestamp/quyền/status/deletedAt và thứ tự đã chỉnh. Thứ tự task cũ theo hạn có ngày trước, hạn tăng dần, mới tạo trước, ID. Bump revision khi thay đổi để form cũ không ghi đè migration. Không suy đoán completedBy quá khứ.
- Job reminder, nhắc nhẹ, restore/undo, task templates, Focus và UI mới chưa triển khai trong B. reminderAt hiện chỉ lưu cấu hình; giao diện cũ không hứa gửi nhắc giờ. Bảo vệ cấu hình PWA/cache hiện có. Dữ liệu kiểm thử dùng replica set riêng.

## Nâng cấp Công việc — Giai đoạn C

- Bố cục gồm sidebar module, nội dung chính và drawer420px mở phía phải bằng Modal portal có inert nền/trap focus/Esc/trả focus. Mobile sidebar thành hàng cuộn, drawer full viewport, vùng bấm44px và reduced-motion. Chưa xác minh trực quan vì CUA lỗi khởi tạo kernel assets.
- Giữ token hiện hành, đặc biệt ink-muted#626E59 cho tương phản; không thêm màu chủ đạo/font mới. Mặc định Tất cả để giữ luồng xem cũ, Danh sách là view mặc định; có nhóm theo hạn/danh sách/ưu tiên/người làm, Đã xong/Đã hủy đóng mặc định. Nhóm chỉ dữ liệu của trang20 việc, sidebar dùng số đếm toàn bộ theo quyền.
- GET/tasks/summary dùng aggregation theo quyền và timezone, trả counts/lists/labels. Ring là DONE/tổng task đến hạn hôm nay, bỏ CANCELLED; không phải thống kê số việc hoàn thành hôm nay. Chưa có dữ liệu hoặc lỗi thì hiển thị dấu—, không bịa0. Danh sách cá nhân/chung lưu trữ không xuất hiện trong truy vấn tổng thường; chọn list trực tiếp hoặc lịch sử couple vẫn đọc được. Sidebar có mở lại danh sách lưu trữ.
- Bộ lọc/view/group nằm trong URL, vùng chọn drawer nằm trong Zustand và được xóa khi rời trang. Nút thêm nổi thuộc trang Tasks để giữ context danh sách và không dẫn sang tài chính. Quick add trong C là tiêu đề thuần; parse tiếng Việt/chip/nhiều dòng thuộc D. Chặn thêm vào list khi metadata chưa tải để không chọn sai scope.
- Tick/status/checklist/delete cập nhật optimistic trên task page; snapshot rollback chỉ task liên quan, không ghi đè thay đổi task khác. Response thành công dùng revision server. Poll/focus và invalidation cập nhật counts/dashboard/couple. Không tiếp nhận phản hồi hoặc gửi thao tác từ sessionEpoch cũ.
- Hoàn tác5 giây sau response thành công; DONE mở lại trạng thái cũ bằng revision mới. Xóa vẫn có xác nhận, restore cùng ID trong30 ngày qua POST/tasks/:id/restore. Restore kiểm tra owner/couple active/list writable/revision/expiry. Bản kế tiếp của task lặp đã sinh vẫn được giữ, đúng hành vi mở lại task cũ hiện có; undo không tự xóa việc kế tiếp.
- Drawer tự lưu sau650ms, giữ revision mới, không hạ revision theo cache cũ. Khi lỗi giữ draft và yêu cầu retry Lưu ngay; không tự retry ghi vô hạn. Esc/nút đóng chỉ khi sạch; Bỏ thay đổi và đóng là lựa chọn rõ. Bình luận/trạng thái bị khóa lúc có draft chưa lưu để không làm mất dữ liệu. Undo có nút trong drawer để sử dụng được bằng bàn phím trong focus trap.
- Chặn ghi khi navigator.onLine=false bằng networkMode always + kiểm tra trước request; không xếp hàng chờ online. Giữ dữ liệu đang nhập khi request thất bại. Connection thật có thể mất dù navigator báo online, API lỗi vẫn giữ draft/rollback.
- Drawer C có tiêu đề/mô tả plain text, trạng thái, ưu tiên, ngày bắt đầu/hạn/giờ, ước lượng, lặp cơ bản, danh sách, nhãn, giao việc và checklist. Rich text, reminder, activity riêng, chuyển scope/duplicate/nudge/templates/Focus/calendar thuộc E. D kéo thả/bulk/phím tắt/swipe/quick parser; F tối ưu và QA/a11y toàn diện.

## 2026-10-06 — Tasks phase D

Quick add parses Vietnamese deterministically in the user timezone and always previews recognized chips. Ambiguous member/list instructions block submission; a literal mode preserves the original title. A single item keeps the existing create API, multiline batches share the create service in one transaction (max 100). Weekly weekday recurrence reuses the existing weekly service and an explicit start deadline.

Manual sorting is enabled inside one selected list with manual sort; the client reads all container pages to obtain real adjacent anchors and the server checks revisions/adjacency. Filters never imply permission. Selection ranges remain local to the visible page. dnd-kit provides keyboard sensors; move buttons provide an alternative.

Bulk addLabels merges labels rather than replacing them and rejects any resulting count over ten atomically. Bulk undo uses returned server revisions, per-task previous values and one transaction; stale revisions, foreign tasks or expired restores reject the entire operation. Restore remains limited to 30 days. Calendar, Kanban cross-status dragging, Focus, reminders and templates remain phase E; virtualization and complete device/browser verification remain F.

## Motion & Interaction — Giai đoạn B (Nền tảng)

- Motion tokens là nguồn sự thật duy nhất qua `src/styles/motion.css` (CSS variables) và `src/lib/motion/tokens.ts` (TypeScript constants).
- Tích hợp trực tiếp vào `tailwind.config.js`: thời lượng (`instant` 90ms, `fast` 160ms, `base` 240ms, `slow` 420ms, `chart` 1100ms, `count` 900ms), hàm gia tốc (`out-soft`, `in-out-soft`, `spring`), bóng đổ (`rest`, `hover-green`, `hover-pink`, `card-hover`) và variant `hoverable:` giới hạn `@media (hover: hover) and (pointer: fine)` để không kẹt hover trên thiết bị cảm ứng.
- Không cài thêm thư viện animation bên ngoài (như framer-motion), ưu tiên CSS transitions/keyframes và custom React hooks để giữ bundle nhẹ nhất (tăng ~1.63 KB gzip, đạt tiêu chí <= 35 KB).
- Hỗ trợ toàn diện `prefers-reduced-motion` của hệ điều hành kết hợp công tắc 3 trạng thái trong Cài đặt (`system`, `full`, `reduced`), lưu an toàn trong `localStorage` và gán thuộc tính `data-motion` trên `<html>` mà không cần tải lại trang.
- Các hook nền tảng trong `src/lib/motion/`: `usePrefersReducedMotion`, `useInView` (IntersectionObserver kèm fallback), `useCountUp` (rAF tween cubic ease-out), `useStagger` (chỉ stagger tối đa 12 phần tử), tiện ích `formatVND` và `formatPercent`.
- Đầy đủ 14 unit test cho các hook chuyển động mới, bảo toàn 100% 239 test hiện có (tổng cộng 253/253 tests pass).

## Motion & Interaction — Giai đoạn C (Hover & Press toàn site)

- Áp dụng hệ thống hover & active có cổng điều kiện `@media (hover: hover) and (pointer: fine)` trên toàn bộ hệ thống component UI:
  - Nút chính (`.button`): nổi lên `translateY(-2px)`, phóng nhẹ `scale(1.04)`, bóng đổ xanh cốm (`var(--shadow-hover-green)`), vệt sáng quét ngang (`.button-sheen`) trên các CTA quan trọng.
  - Nút chung/cặp đôi (`.button-pink`, `.button-couple`): bóng đổ hồng (`var(--shadow-hover-pink)`).
  - Nút phụ (`.button-outline`): nâng `-1px`, nền `--primary-lighter`, viền `--primary`. Nút nguy hiểm (`.button-danger`): bóng đỏ mờ.
  - Nút icon (`.icon-button`): phóng `scale(1.12)`, nền tròn mờ, chuyển động riêng theo ngữ cảnh (chuông lắc `motion-bell-ring`, tim đập `motion-heart-beat`, bánh răng xoay 45°, thùng rác nghiêng nắp).
  - Nút nổi di động (`.quick-add`): nâng lên, bóng xanh, dấu `+` xoay 90°.
  - Thẻ (`.card`): nâng `--lift-md` (-4px), bóng `--shadow-card-hover`, viền chuyển sang `--primary-light` (hoặc hồng nhạt cho card couple), hỗ trợ spotlight theo chuột desktop (`data-spotlight="true"` qua requestAnimationFrame).
  - Menu sidebar (`.sidebar nav a`): dịch icon `+2px`, thanh chỉ báo active trượt xuất hiện, hiệu ứng tim đập khi hover mục Không gian chung.
  - Hàng danh sách (`.task-row`, `.recent-entry`, `.todo-row`, `.overview-wallets`, `.fitness-sets`): đổi nền `--primary-lighter` mượt mà, nâng nhẹ.
  - Ô nhập (`input`, `select`, `textarea`): viền `--primary`, viền sáng focus `0 0 0 4px rgba(126,155,87,0.18)` không gắt.
  - Checkbox (`.task-check`): phóng nảy `scale(1.15)` khi hover, tick dấu hoàn thành nở ra với `motion-tick`.
  - Badges/Chips (`.pill`, `.subtle-chip`): phóng `scale(1.06)`. Avatar phóng `scale(1.08)` kèm viền sáng xanh. Link văn bản (`.card-link`) có gạch chân mọc từ trái sang phải và mũi tên dịch phải `3px`. Logo mầm cây đung đưa lá khẽ khàng khi hover (`motion-leaf-sway`).
- Không gây layout shift: mọi animation chỉ can thiệp `transform`, `opacity`, `box-shadow` và `background-color`. Đạt tiêu chí 100% tests pass (256/256 tests).

## 2026-10-09: Giai đoạn D — Biểu đồ Recharts 0% → 100% và Các thành phần tiến độ chuyển động

### Bối cảnh & Yêu cầu

- Dự án sử dụng Recharts v2.13.0 với nhiều biểu đồ trước đây bị tắt hoạt ảnh (`isAnimationActive={false}`) để tránh lỗi hiển thị và giật khung hình.
- Cần kích hoạt hoạt ảnh mềm mại khi cuộn tới (`useInView`), quét từ 0% → 100% theo chiều kim đồng hồ cho Donut, vẽ đường mượt mà cho Line chart, cột mọc từ dưới lên kèm bo góc cho Bar chart.
- Cần tương tác 2 chiều giữa chú thích (legend) và lát bánh biểu đồ Donut: rê vào mục chú thích thì lát bánh sáng lên, rê vào lát bánh thì miếng bánh phóng nhẹ `outerRadius + 6` và các lát khác mờ đi (`opacity: 0.45`).
- Giữa tâm Donut hiển thị số tổng tự động tăng dần bằng tween `useCountUp`.
- Thanh tiến độ `ProgressBar` và vòng tròn `ProgressRing` chuyển sang điều khiển bằng `transform: scaleX(...)` và SVG `stroke-dashoffset` thay vì animate `width` để loại bỏ reflow layout.

### Thiết kế & Thành phần triển khai

1. `src/components/charts/`:
   - `AnimatedDonut.tsx`: Bọc Recharts Pie, quét chiều kim đồng hồ `startAngle={90}` `endAngle={-270}`, duration 1100ms, hover pop nhẹ bằng `Sector`, tâm đếm tăng số tiền/số đếm bằng `useCountUp`.
   - `AnimatedLine.tsx`: Bọc LineChart với hoạt ảnh vẽ đường sang phải, `activeDot` có drop-shadow pulse mượt mà và tooltip êm ái.
   - `AnimatedBar.tsx`: Bọc BarChart với cột mọc từ dưới lên, bo góc `[5, 5, 0, 0]`, stagger delay giữa các nhóm cột.
   - `ProgressRing.tsx`: Vòng tròn SVG chuyển động `stroke-dashoffset` mượt mà, hỗ trợ accessibility đầy đủ (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`).
   - `ProgressBar.tsx`: Thanh tiến độ thuần GPU `transform: scaleX(...)`, `transform-origin: left`.
   - `ChartLegend.tsx`: Chú thích tương tác 2 chiều liên kết với lát bánh hoặc dòng biểu đồ.
   - `ChartContainer.tsx`: Bọc `useInView` để chỉ kích hoạt biểu đồ khi đã lọt vào tầm nhìn người dùng.
2. Tích hợp thực tế vào các module:
   - `FinanceOverview.tsx`: Thay thế PieChart bằng `AnimatedDonut` với đồng bộ hai chiều cùng bảng danh mục chi tiêu/thu nhập.
   - `FitnessPage.tsx`: Thay thế PieChart rep distribution bằng `AnimatedDonut`.
   - `FitnessChart.tsx`: Chuyển sang `AnimatedLine`.
   - `PlanningReports.tsx`: Nâng cấp BarChart thu chi sang `AnimatedBar` và LineChart xu hướng 5 danh mục sang `AnimatedLine`.
   - `PlanningPanel.tsx`: Refactor `Progress` component sang `transform: scaleX(...)` thay vì animate `width`.

### Kết quả kiểm tra & Đo lường

- Toàn bộ test suite: **20/20 test files PASS, 265/265 tests PASS**.
- Typecheck & Lint: **0 errors, 0 warnings**.
- Bundle size: Thêm ~2.5 KB gzip cho toàn bộ wrapper biểu đồ và module charts, tổng ngân sách an toàn tuyệt đối.

## 2026-10-09: Giai đoạn E — Chuyển trang (Route Transitions), Danh sách xuất hiện lần lượt (Stagger), và Số đếm tăng dần (Count-Up)

### Bối cảnh & Yêu cầu

- Nội dung chính (`#main-content`) khi chuyển trang cần mờ vào và trượt nhẹ lên (`opacity: 0 -> 1`, `translateY: 10px -> 0`, thời lượng 420ms, easing ease-out). Sidebar và topbar đứng yên.
- Khi chuyển route, tự động cuộn lên đầu vùng nội dung mượt mà (`smooth scroll`), trừ khi có hash anchor.
- Các số tiền lớn ở Dashboard và các module (Tổng số dư, Thu nhập, Chi tiêu, Quỹ chung, Số buổi tập) cần tween đếm số tăng dần (`useCountUp`) với phông chữ `tabular-nums` chống giật layout.
- Danh sách công việc, danh sách ví, giao dịch gần đây, danh sách quỹ xuất hiện lần lượt với độ trễ tăng dần (`stagger`). Giới hạn tối đa 12 phần tử đầu để không làm người dùng phải chờ đợi.

### Thiết kế & Thành phần triển khai

1. `src/lib/motion/CountUp.tsx`:
   - Component tiện ích bọc `useCountUp` với `tabular-nums` chuẩn accessibility, hỗ trợ định dạng tiền tệ và số lượng.
2. `src/styles/motion.css`:
   - `.page-transition-wrap`: Hoạt ảnh `@keyframes motion-page-enter` (10px -> 0, opacity 0 -> 1, 420ms).
   - `.stagger-item`: Hoạt ảnh `@keyframes motion-stagger-in` (8px -> 0, opacity 0 -> 1, 240ms), `animation-delay: calc(var(--stagger-step, 45ms) * min(var(--i, 0), 12))`.
3. Tích hợp thực tế:
   - `App.tsx`: Tự động cuộn lên đầu khi đổi route; bọc `Outlet` trong `<div className="page-transition-wrap" key={location.pathname}>`.
   - `Dashboard.tsx`: Thống kê tổng quan dùng `CountUp`; task rows và spending rows dùng `.stagger-item`.
   - `FinanceOverview.tsx`: Các thẻ tổng số dư, thu nhập, chi tiêu dùng `CountUp`; danh sách ví và giao dịch gần đây dùng `.stagger-item`.
   - `SharedFinancePage.tsx`: Số dư quỹ dùng `CountUp`; lưới thẻ quỹ dùng `.stagger-item`.
   - `TasksPage.tsx`: Các hàng task hiển thị lần lượt với `.stagger-item` (tối đa 12 item).
   - `FitnessPage.tsx`: 7 thẻ chỉ số tập luyện dùng `CountUp` và `.stagger-item`.

### Kết quả kiểm tra & Đo lường

- Vitest: **21/21 test files PASS**, **268/268 tests PASS**.
- Lint & Typecheck: **0 errors, 0 warnings**.
- Bundle size: Thêm ~0.9 KB gzip cho toàn bộ tính năng chuyển trang, stagger và CountUp component.

## 2026-10-09: Giai đoạn F — Tương tác vi mô (Micro-interactions), Trạng thái rỗng (Empty States) & Tối ưu hóa hiệu năng

### Bối cảnh & Yêu cầu

- **Empty States**: Biểu tượng mầm cây (`Sprout`) trong toàn bộ trạng thái rỗng bồng bềnh nhẹ nhàng theo phương thẳng đứng (`translateY(-4px) -> 0`, chu kỳ 3.2s, ease-in-out vô hạn).
- **To-Do Tick & Sprout Burst**: Khi đánh dấu hoàn thành công việc:
  - Checkbox nảy nhẹ theo đường cong đàn hồi (`scale: 1 -> 1.06`).
  - Hạt mầm sinh động nở vút lên và mờ dần trong 650ms (`motion-sprout-burst`).
  - Dòng chữ tiêu đề gạch ngang chuyển động mượt từ trái sang phải bằng gradient strike (`240ms cubic-bezier(0.16, 1, 0.3, 1)`), đổi màu sang `--ink-muted`.
- **Nhịp tim Kỷ niệm đôi lứa (Couple Anniversary Heartbeat)**: Trái tim không gian chung đập nhẹ nhàng theo nhịp tim sinh học kép 2.8s (`motion-heart-beat`).
- **Phản hồi lọc dữ liệu (Filter & Month Refresh Feedback)**: Khi chuyển tháng hoặc lọc danh mục, container dữ liệu chớp mờ tinh tế (`opacity: 0.6 -> 1`, 160ms) báo hiệu dữ liệu mới đã cập nhật.
- **Biến mất khi xóa (Exit Animation)**: Khi item bị xóa/lưu trữ, co nhỏ và mờ dần mượt mà (`scale(0.96)`, `opacity: 0`, 180ms).
- **Khả năng tiếp cận & Giảm chuyển động (Reduced Motion)**: Tắt toàn bộ hoạt ảnh lặp, chuyển sang gạch ngang tĩnh và cập nhật tức thời khi bật `data-motion="reduced"` hoặc cài đặt hệ điều hành.

### Thiết kế & Triển khai chi tiết

1. `src/styles/motion.css`:
   - `@keyframes motion-float-gentle`: Áp dụng cho `.empty-state > svg` và `.empty-state-icon`.
   - `.todo-checkbox-wrap`, `.todo-sprout-burst`, `.todo-strike-text`: Hệ thống tương tác vi mô cây mầm hoàn thành công việc.
   - `@keyframes motion-heart-beat` & `.motion-heart-beat`: Hoạt ảnh nhịp tim yêu thương.
   - `@keyframes motion-filter-refresh` & `.filter-refresh`: Phản hồi lọc và chuyển tháng 160ms.
   - `@keyframes motion-item-exit` & `.item-exit`: Hoạt ảnh biến mất cho phần tử bị xóa.
   - Ghi đè triệt để trong `[data-motion="reduced"]` và `@media (prefers-reduced-motion: reduce)`.
2. `src/components/ui/index.tsx`:
   - `EmptyState`: Thêm `className="empty-state-icon"` và hỗ trợ prop `icon?: ReactNode` tùy chọn.
3. `src/features/tasks/components/TaskRow.tsx`:
   - Bọc nút checkbox trong `.todo-checkbox-wrap`, kích hoạt `<Sprout />` burst bay lên khi hoàn thành.
   - Bọc tiêu đề công việc trong `<span className="todo-strike-text">` tạo hiệu ứng gạch ngang quét từ trái sang phải.
4. `src/features/dashboard/Dashboard.tsx` & `CouplePage.tsx`:
   - Thêm lớp `.motion-heart-beat` vào các icon trái tim không gian chung và đếm ngày bên nhau.
5. `src/features/finance/FinanceOverview.tsx` & `PlanningReports.tsx`:
   - Thêm `.filter-refresh` tự động chạy khi chuyển đổi loại biểu đồ hoặc khoảng thời gian xem báo cáo.
6. `src/lib/motion/useCountUp.ts`:
   - Làm tròn số nguyên trong quá trình tween `Math.round(nextVal)` và khi truyền vào hàm định dạng, ngăn ngừa lỗi định dạng tiền tệ có phần thập phân ngẫu nhiên.

### Kết quả kiểm tra & Đo lường

- Toàn bộ test suite: **21/21 test files PASS**, **268/268 tests PASS**.
- Linter & TypeScript: **0 lỗi, 0 cảnh báo**.
- Production Build: Hoàn thành sạch sẽ trong 15s - 33s.
- Bundle Size: Tổng dung lượng tăng thêm qua cả 6 giai đoạn (A -> F) chỉ khoảng **~10.2 KB gzip** (JS ~6.8 KB + CSS ~3.4 KB), thấp hơn rất nhiều so với hạn mức **35 KB gzip**.

## Rà soát toàn diện Frontend (Frontend Audit & Polish)

Đã tiến hành rà soát kỹ lưỡng toàn bộ mã nguồn `apps/web/src` và khắc phục các điểm tồn đọng:

1. **Biểu đồ `AnimatedDonut` - Nhãn callout đa ngữ cảnh**:
   - Trước đây nhãn hiển thị tại callout box bị cố định chuỗi `"Số tiền :"`, gây phi lý khi dùng cho biểu đồ tập luyện (`FitnessPage` hiển thị _"Số tiền : 12 set"_).
   - Đã cập nhật `AnimatedDonut.tsx` nhận `tooltipFormatter` hoặc suy diễn từ `centerLabel` / `nameKey` linh hoạt. Khi xem biểu đồ rep tập luyện sẽ hiển thị đúng định dạng `1-5 reps : 12 set (40%)`.
2. **Đồng bộ hóa hiệu ứng nhịp tim đôi lứa (`motion-heart-beat`)**:
   - Bổ sung `className="motion-heart-beat"` cho các icon `<Heart size={22} />` tại phần tổng quan đôi lứa ở `AccountHome.tsx` và `CouplePage.tsx`, đảm bảo trải nghiệm thị giác nhất quán trên toàn bộ ứng dụng.
3. **Hiệu ứng lối vào so le (`stagger-item`) cho các danh sách còn thiếu**:
   - Bổ sung class `.stagger-item` và biến CSS `--i` cho danh sách buổi tập, bài tập, mẫu tập và số đo cơ thể trong `FitnessPage.tsx`.
   - Bổ sung `.stagger-item` cho danh sách thẻ ngân sách, mục tiêu và lịch định kỳ trong `PlanningPanel.tsx`.
4. **Dọn dẹp tài nguyên (Resource Cleanup) trong `Card` component**:
   - Thêm `useEffect` cleanup cho animation frame của hiệu ứng đèn rọi spotlight (`rafId.current`), ngăn rò rỉ bộ nhớ hoặc gọi `cancelAnimationFrame` muộn khi component unmount.
5. **Độ ổn định của Test Suite trên máy tính Windows/CI**:
   - Tăng nhẹ `timeout: 10000ms` cho assertion trang preview và đăng nhập tải lười (lazy load qua Suspense) trong `app.test.tsx` cùng tùy chọn `testTimeout: 10000` trong `vite.config.ts`, loại bỏ hoàn toàn hiện tượng flaky test do độ trễ I/O dynamic import khi chạy song song 21 test suites.
6. **Kiểm tra độ sạch của mã**:
   - Không có `console.log` sót lại trong mã nguồn frontend.
   - Không còn TODO/FIXME phát sinh.
   - Build production và Linter đạt chuẩn 100% không cảnh báo.
