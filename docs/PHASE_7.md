# Giai đoạn 7 — Tập luyện cá nhân

Đã triển khai mục10 của master prompt và FitnessPreview trên trang chủ. Mở `/fitness` sau khi đăng nhập. Dữ liệu tập luyện/số đo luôn riêng tư, kể cả Couple active. Thông báo và dashboard tổng hợp tiếp theo thuộc giai đoạn8.

## Chức năng đã có

- 11 bài hệ thống kèm nhóm cơ, tạo/sửa/xóa bài riêng; bảo vệ bài đã có lịch sử hoặc được dùng trong mẫu.
- CRUD buổi tập: ngày, số phút, ghi chú, cảm giác1–5, cân nặng, giờ bắt đầu/kết thúc tùy chọn. Khi nhập đủ giờ, máy chủ tính số phút. Lưu buổi mới mở ngay chi tiết ghi set.
- CRUD set: bài, kg, rep, số thứ tự, done, loại khởi động/chính/drop/đến giới hạn, RPE. Sao chép set, gợi ý kg/rep lần trước không ghi đè dữ liệu vừa nhập, bộ đếm giờ nghỉ có dừng/tiếp tục/đặt lại.
- Volume theo buổi, lọc7/30/90 ngày, khoảng ngày và bài. Donut số set/phần trăm cho1–5,6–12,13+ rep; có bảng số liệu volume.
- Số buổi tuần/tháng, TB rep/set, TB/tổng phút, volume buổi gần nhất, tần suất theo khoảng. So sánh tuần này/tuần trước; mục tiêu buổi/tuần với thanh tiến độ.
- Đường kg cao nhất và Epley1RM theo từng bài; không gộp kg nhiều bài. PR tự tính trọng lượng, volume của bài/buổi,1RM, phân biệt mốc đầu và phá kỷ lục. Chỉnh/xóa dữ liệu tính lại báo cáo.
- Mẫu tập từ biểu mẫu hoặc buổi đã ghi; bắt đầu từ mẫu tạo set chưa hoàn thành trong cùng transaction. Mẫu có sửa/xóa.
- Nhật ký cân nặng/eo/ngực/hông/tay/đùi có sửa/xóa, biểu đồ chọn từng chỉ số. Một bản số đo/ngày/người; ngày trùng yêu cầu sửa bản đã có.
- Trang chủ có buổi gần nhất, số buổi tuần, volume tuần và mini biểu đồ. Khối Tiếp tục lấy buổi gần nhất có set hoàn thành, hiển thị bài/kg/rep, kể cả buổi mới nhất còn trống.
- Giao diện giữ thiết kế xanh/kem hiện có, bảng và biểu mẫu thích ứng điện thoại; states tải/trống/lỗi có xử lý. OpenAPI0.8.0 mô tả toàn bộ tài nguyên và báo cáo.

## Kiểm chứng ngày4/10/2026

- Toàn bộ API: **211/211 kiểm thử qua**, trên MongoDB replica set thử nghiệm riêng. Fitness có20 kiểm thử bao gồm giao dịch rollback, số thứ tự khi ghi đồng thời, revision, privacy, HTTP validation và các phép tính. Coverage Fitness service:99,48% statements,96,99% branches,100% functions,99,72% lines.
- Toàn bộ web: **118/118 kiểm thử qua**, gồm18 kiểm thử Fitness cho form, gợi ý, tick/sao chép, xóa có xác nhận, bộ đếm giờ, lỗi tải và chặn phản hồi của phiên đăng nhập cũ.
- Lint, build và kiểm tra định dạng qua. Build vẫn có cảnh báo bundle lớn; chưa tối ưu tải theo từng trang. Cảnh báo React Router future flags trong môi trường dev không phải lỗi runtime.
- API local thực: dùng hai tài khoản QA giả ghép đôi, không dùng tài khoản demo. Tạo4 buổi/20 set/4 ngày số đo và mẫu. Volume buổi cuối2460 =75×5 +65×10 +45×15 +95×8; set100×10 chưa hoàn thành bị loại. Tổng16 set hoàn thành, donut4/8/4 =25/50/25%. Người cùng cặp đọc buổi người kia trả404, sổ tập/số đo của họ trống.
- Trình duyệt: tạo buổi35phút, mở ngay phần ghi set; chọn Bench Press tự điền45kg×15rep từ set hoàn thành cuối lần trước. Lưu80×8,RPE8,5 được volume640. Sao chép set thứ2 được1280; bỏ tick set2 trở lại640. Lưu thành mẫu rồi bắt đầu buổi mới có hai set đều chưa hoàn thành, volume0. Sửa số đo eo76,5→76cm, đổi khoảng7ngày/bài và xem tiến triển riêng. Mở gợi ý tiếp tục thành công.
- Đọc API lại sau thao tác UI:6 buổi,270phút,17 set hoàn thành. Buổi mới nhất từ mẫu có volume0; continueFrom vẫn lấy buổi35phút với Bench80×8,volume640. Không nhận set chưa hoàn thành làm gợi ý mới.
- Kiểm tra desktop và điện thoại390×844: biểu đồ và modal hiển thị được, không tràn ngang. Đổi sang tài khoản QA thứ2 trên cùng trình duyệt vẫn thấy toàn bộ thống kê0; không lộ cache tài khoản đầu.
- Đã xóa mềm dữ liệu và đúng hai tài khoản QA, lưu trữ cặp thử; token cũ trả401. Tài khoản demo và dữ liệu hiện hữu không bị thay đổi. Ảnh kiểm chứng ngoài repo: `mam-chung-phase-7.png`, `mam-chung-phase-7-full.png`, `mam-chung-phase-7-mobile.png`, `mam-chung-phase-7-private.png`; các số trong ảnh là dữ liệu thử trước khi dọn.

## Quy tắc sử dụng

Buổi đã ghi, kể cả chưa có set, vẫn tính số buổi và thời gian; chỉ set đã hoàn thành tính volume/rep. Khởi động tính volume/rep nhưng bỏ khỏi PR/1RM. Epley là ước tính theo công thức được yêu cầu. PR volume theo một bài trong một buổi. Tuần bắt đầu thứ Hai theo timezone hồ sơ; tuần này so đến hôm nay với cả tuần trước. Lịch ngày tương lai không tính vào tuần/tháng hiện tại hoặc gợi ý gần nhất.

Ngày buổi theo hồ sơ; giờ start/end theo đồng hồ thiết bị. Cân nặng của buổi không tự ghi sang nhật ký số đo. Gợi ý dùng set hoàn thành cuối của bài trong buổi gần nhất. Đóng/mở lại form khi gặp409 revision cũ. Body PUT thay thế, bỏ trống số đo là null. Xóa buổi xóa toàn bộ set trong cùng transaction và cập nhật PR.

## Giới hạn kiểm chứng

Đã kiểm tra bản phát triển local, chưa xác minh Docker/hosting/production, hiệu năng với lịch sử lớn hoặc thiết bị thật ngoài viewport trình duyệt. Rest timer chỉ trên trang đang mở, không có push/chuông nền. Notification/PWA và hoàn thiện production thuộc các giai đoạn tiếp theo. API chi tiết tại [API.md](API.md), quyết định tại [DECISIONS.md](DECISIONS.md), Swagger `/api/docs`.
