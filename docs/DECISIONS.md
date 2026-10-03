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
