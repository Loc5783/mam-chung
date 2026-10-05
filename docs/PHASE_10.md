# Giai đoạn 10 — Kiểm thử toàn diện luồng chính

Ngày kiểm chứng: 04/10/2026. Mã nguồn tại `E:\mam-chung`.

## Phần hoàn thành

Bổ sung 5 kiểm thử tích hợp HTTP trong `apps/api/src/tests/workflows.test.ts`, dùng Express thật qua Supertest và MongoDB replica set tạm. Đây là 5 kịch bản với nhiều bước và assertion, không phải 5 lần bấm giao diện.

| Kịch bản tự động          | Điều kiện đã kiểm chứng                                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tài khoản và phiên        | Đăng ký, hồ sơ không chứa passwordHash, refresh rotation, logout thu hồi access token, origin lạ bị chặn                                                                            |
| Tài chính cá nhân         | Tạo ví/sửa chi/chuyển tiền/rollback khi thiếu tiền, ngân sách và thông báo, mục tiêu và hoàn tác, xóa chi/đối soát, CSV chứa giao dịch, partner không đọc ví riêng                  |
| Couple và tài chính chung | Mời/chấp nhận, đóng góp, khoản ứng101đ chia nợ50đ, đúng vai trò báo trả/xác nhận, debt về0, outsider bị chặn, chủ cặp không được rời trước chuyển quyền, thành viên rời lưu trữ cặp |
| Công việc                 | Phân quyền riêng/chung, giao việc, bình luận, sửa với revision cũ409, hoàn thành việc lặp chỉ sinh một việc tiếp theo                                                               |
| Fitness                   | Set50kg×8=400, sửa60kg×8=480, mẫu tạo set chưa hoàn thành không cộng volume, partner không đọc buổi tập riêng, xóa buổi cập nhật thống kê                                           |

`npm test` tự bao gồm các kịch bản mới. GitHub CI chưa được chạy vì dự án chưa có remote. Chưa thêm job Playwright CLI độc lập.

## Kiểm chứng thực trên trình duyệt

CUA sử dụng locator Playwright trên **bản build có PWA**, kết nối API và MongoDB thật của môi trường QA. Hai tài khoản giả Minh QA/An QA được đăng ký bằng biểu mẫu. Database tạm, tách khỏi tài khoản demo và `.local/data`; toàn bộ số tiền dưới đây là dữ liệu kiểm thử, không chuyển tiền thật.

| Luồng giao diện                     | Kết quả đã quan sát                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Đăng ký/đăng nhập/đăng xuất/tải lại | Chuyển đúng tài khoản; refresh khôi phục phiên và dữ liệu sau tải lại                                                                 |
| Ví và chi tiêu                      | Ví1.000.000đ, chi240.000đ, số dư760.000đ; ngân sách200.000đ hiển thị120% và chuông cảnh báo                                           |
| Khoản chi vượt số dư                | Chi900.000đ bị từ chối với thông báo thiếu tiền; form giữ dữ liệu, sổ vẫn2 dòng/chi240.000đ                                           |
| Công việc lặp                       | Checklist1/1 và trạng thái hoàn thành; sinh đúng việc ngày mai với checklist0/1                                                       |
| Buổi tập                            | Buổi45 phút, Bench Press50kg×8 hoàn thành; tổng quan volume400                                                                        |
| Ghép đôi và riêng tư                | An không thấy ví, việc riêng hoặc buổi tập Minh trước/sau ghép đôi; chỉ việc chung xuất hiện ở An                                     |
| Tiền chung và khoản lẻ              | Quỹ300.000đ; khoản ứng101đ chia đều tạo nợ50đ, không trừ quỹ                                                                          |
| Công nợ hai bước                    | An báo đã trả, chỉ Minh có nút nhận tiền; Minh xác nhận, công nợ0/chờ xác nhận0/quỹ300.000đ; thông báo liên quan hết hiệu lực         |
| Việc chung và bình luận             | An tạo việc giao Minh và bình luận; Minh đọc được bình luận, hoàn thành; tổng quan hôm nay0 và thông báo giao/hạn việc biến mất       |
| PWA cập nhật                        | Bản mới chờ nút cập nhật; bấm cập nhật khôi phục phiên và dữ liệu                                                                     |
| Mã mời đã dùng                      | Không được chấp nhận lại; hiện thông báo mã không còn hiệu lực                                                                        |
| Route không tồn tại                 | Thông báo đúng đường dẫn không tồn tại và nút trở về tổng quan hoạt động                                                              |
| Màn hình nhỏ                        | Kiểm tra tổng quan viewport390×844, không tràn ngang: clientWidth=scrollWidth=375 (phần thanh cuộn chiếm15px); lưu ảnh desktop/mobile |

Số liệu tổng quan cuối: cá nhân760.000đ, chi240.000đ, ngân sách120%, việc hôm nay0, volume400, quỹ300.000đ, công nợ cân bằng. Ảnh bằng chứng được lưu ngoài repository trong thư mục outputs của chat để không đưa dữ liệu QA vào Git.

CSV HTTP được kiểm tra tự động. Đã bấm xuất CSV trên giao diện nhưng trình duyệt tích hợp không trả sự kiện tải file trong10 giây; vì vậy **chưa xác nhận file CSV tải về trên trình duyệt**, không coi thao tác bấm là bằng chứng tải thành công. Console QA không ghi lỗi/warning tại lúc kiểm tra.

## Sửa lỗi phát hiện

- Trang `/invite/:code` trước đây mang tiêu đề Cài đặt/Không gian cá nhân; đổi thành Lời mời/Không gian chung và kiểm chứng trên bản build mới.
- Route không tồn tại trước đây dùng nội dung chức năng sẽ được triển khai; thay bằng thông báo đúng404 và tiêu đề thanh đầu trang tương ứng.
- Health trả phase10, tài liệu OpenAPI1.1.0. Không thay thuật toán tiền hoặc phân quyền khi chưa có bằng chứng sai.

Các thất bại lúc xây kịch bản HTTP ban đầu do fixture/contract: tên quá ngắn, phương thức PATCH trạng thái, `/start` cho mẫu và quy tắc chủ cặp rời. Đã sửa kiểm thử theo API hiện có; không ghi nhận chúng là lỗi sản phẩm.

## Kết quả kiểm tra mã nguồn

- Backend: **237/237**, 10 suite. Coverage service: statements98,59%, branches91,74%, functions100%, lines99,26%; đều vượt ngưỡng80%.
- Frontend: **150/150**, 11 file kiểm thử. Lần chạy đầu đồng thời backend bị timeout5 giây khi import trang preview; lần chạy lại toàn bộ đạt, preview tải trong3,569 giây. Không sửa logic sản phẩm để che lỗi chờ kiểm thử; cần theo dõi độ ổn định này khi có CI.
- TypeScript/ESLint và build: đạt.
- `check:pwa`: 30 tài nguyên công khai, 3 iconPNG, chunk lớn nhất411.704byte, không cache file riêng/API, không còn placeholder.
- Format và `git diff --check`: đạt.
- Launcher QA bản cuối: web/API trả200, health phase10 và development=false; nhập q trong terminal dừng với exit0 và thông báo database tạm đã dọn. Website chính health phase10/development=true, web200.

## Chạy lại

```powershell
npm run build
npm run qa:local
```

Dùng `http://localhost:5174/register`, tạo hai tài khoản QA giả mới. Cổng web5174/API4001/Mongo27119 phải trống; launcher dùng DB tự sinh và khóa JWT riêng. Không đổi cookie của website chính127.0.0.1:5173. Giữ rate limit như sản phẩm. Nhập `q` rồi Enter để dừng và dọn DB tạm do launcher tạo (cũng hỗ trợ `Ctrl+C`); không dọn `.local/data`.

```powershell
npm run test:workflows
npm test
npm run lint
npm run build
npm run check:pwa
npm run format:check
```

Có thể đặt `MONGOMS_DOWNLOAD_DIR` trỏ tới `.local/mongodb-binaries` để Jest dùng binary đã tải. Bộ HTTP dùng database tạm riêng, không cần bật website chính.

## Giới hạn và bước tiếp theo

Đã kiểm chứng các luồng chính local; chưa chứng nhận mọi thiết bị, screen reader/WCAG, tải nhiều người dùng hoặc mọi tổ hợp thao tác. Chưa thử cài PWA trên hệ điều hành di động thật, chưa có E2E trình duyệt tự chạy trong CI, chưa kiểm chứng tải CSV trên IAB. HTTPS/domain/Docker/backup/restore trên server thuộc **giai đoạn11**, chưa triển khai trong giai đoạn này. Báo cáo PWA ngoại tuyến của giai đoạn9 được giữ riêng, không coi là phép thử mới của giai đoạn10.
