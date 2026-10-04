# Giai đoạn 9 — Hoàn thiện trải nghiệm

Ngày kiểm chứng: 4/10/2026. Dữ liệu demo và ảnh đều là dữ liệu giả. Hoàn thành phạm vi responsive/PWA, khả năng truy cập, chia gói, seed demo và Swagger; kiểm thử E2E toàn diện/triển khai production thuộc giai đoạn10–11.

## Chức năng và sửa lỗi

- React.lazy/Suspense theo trang, ranh giới lỗi có nút tải lại. Tách Tasks/Fitness preview và biểu đồ dùng chung để Dashboard không kéo toàn bộ trang.
- Icon192/512/maskable, manifest standalone, offline page và service worker được tạo khi build. Cache chỉ allowlist công khai. Không cache API/token/cookie/trang tài khoản; không có queue ghi ngoại tuyến. Khi mất mạng, giao diện đang mở nhắc cần kết nối; navigation thất bại hiện offline page chung.
- Cài khi trình duyệt có beforeinstallprompt, chỉ gọi prompt khi bấm. Worker mới chờ người dùng lưu biểu mẫu và bấm cập nhật, không tự reload. Lỗi cài không làm hỏng website.
- Modal portal, inert nền, bẫy Tab/ShiftTab, Escape theo busy, giữ vị trí nhập khi state thay đổi và trả focus lúc đóng. Skip link/main focus, tab mũi tên/Home/End, focus ring, reduced motion, tăng tương phản chữ/nút và input16px/nút44px trên mobile.
- Sửa topbar bị chồng chữ320px, hạn chế chiều cao modal, đặt thông báo PWA bên trên bottom navigation và bên ngoài sidebar desktop.
- Seed hai tài khoản đánh dấu demo, chỉ loopback4000 và API development. Chạy lại giữ tài nguyên đã có theo tên/ghi chú, bổ sung phần thiếu; không reset hoặc sửa tài khoản trùng email khác tên/mật khẩu. Trạng thái báo đã trả tiền mẫu chỉ tạo khi khoản chi cá nhân mẫu vừa được tạo. Không dùng trên dữ liệu production, không chạy đồng thời.
- Swagger1.0.0/Health schema, sửa lỗi các nhóm nghiệp vụ thiếu `/api` trong đường dẫn. Trước đó một số nút Try it out gọi vào `/wallets` thay vì `/api/wallets`. Mọi path cuối thống nhất `/api/...` và giữ Bearer auth. Không đổi đường dẫn API chạy thật.

## Kiểm tra tự động

- API: **232/232** kiểm thử qua, coverage service98,59% statements /91,61% branches /100% functions /99,26% lines, qua ngưỡng80%. Kiểm thử mới đọc OpenAPI qua HTTP và kiểm tra tiền tố nghiệp vụ/Bearer/Health; health development=false trong test.
- Web: **150/150** kiểm thử qua. Thêm16 kiểm tra modal/focus/busy/tablist, offline/install và worker (loại API/mutation/cross-origin/query, navigation không lưu response, allowlist, activation có chủ ý).
- Lint, build, format và `check:pwa` qua. Checker kiểm tra30 tài nguyên công khai,3 icon PNG đúng kích thước, không có placeholder, không có đường dẫn riêng trong allowlist, chunk lớn nhất411.704 bytes.
- Build cũ một gói965,89KB; bản này index211,84KB (gzip67,14), react-vendor165,55KB (gzip53,90), charts411,70KB (gzip110,94), các trang riêng. Tải khởi đầu còn gồm react-vendor, không chỉ index. Không còn cảnh báo chunk>500KB. Worker precache mọi asset nên tổng tải lần cài không giảm; chưa đo Lighthouse/Web Vitals hoặc thời gian tải thiết bị thật.
- OpenAPI đã đóng gói:84 paths/118 schemas, không thiếu schema reference. Đối chiếu122 thao tác nghiệp vụ (route tĩnh và7 route Fitness/công nợ tạo trong vòng lặp) với OpenAPI sau sửa tiền tố, không thiếu. Các path param chuyển đúng `{id}`/`{code}`.

## Kiểm tra local và trình duyệt

- Seed chạy ba lần;1 ví cá nhân11.900.000đ,1 quỹ1.250.000đ,1 contribution,2 khoản chi chung,1 nợ150.000đ pending_confirm,3 việc,3 buổi/9 set,1 mẫu tập/1 số đo. Partner0 ví/0 buổi tập riêng. Không tạo trùng khi chạy lại liên tiếp. Ngày mẫu theo ngày tạo lần đầu, không dịch ngày khi chạy lại.
- Dashboard thực hiển thị thu12.000.000đ/chi2.100.000đ/budget105%, tuần3 buổi volume4.680 và365 ngày bên nhau. Demo `demo@mamchung.test` giữ nguyên.
- Production build kiểm tra trên frontend QA localhost5174, API local4000, tách cookie khỏi hai tab người dùng trên127.0.0.1:5173. Trình duyệt cập nhật worker sau bấm Cập nhật ứng dụng, giữ đăng nhập và trang đang mở.
- Tắt riêng frontend QA, mở document mới `/settings`: hiện Mầm Chung đang mất kết nối, không có tên/email/số tiền. Mở lại frontend và bấm Thử kết nối lại khôi phục trang tài khoản; Dashboard vẫn đúng. API/main5173 không bị tắt trong phép thử offline này.
- 320×740: Home/Finance/Tasks/Fitness/Couple/Shared document scrollWidth305≤320; modal320≤320. Nhập mô tả giữ focus đúng ô, nền inert; Escape đóng mà không lưu giao dịch. Mũi tên chọn Danh mục/Kanban/Buổi tập, End chọn Mục tiêu chung.
- 390×844 Dashboard scrollWidth375; desktop1280×720 scrollWidth1265: không tràn ngang. Không có console error/warn trong lượt kiểm tra online/phục hồi. Đã lưu ảnh desktop/mobile/update/offline ngoài repo: `mam-chung-phase-9.png`, `mam-chung-phase-9-mobile.png`, `mam-chung-phase-9-update.png`, `mam-chung-phase-9-offline.png`.

## Hướng dẫn và giới hạn

Chạy `npm run dev:local`, cửa sổ thứ hai `npm run seed:demo:local`. Đăng nhập minh.demo@mamchung.test hoặc an.demo@mamchung.test, mật khẩu DemoMam2026!. Mọi dữ liệu là giả.

Service worker chỉ đăng ký trên bản build qua HTTPS/localhost, không đăng ký Vite dev5173. Cần tải xong tài nguyên khi có mạng trước khi offline fallback hoạt động. Không hỗ trợ xem/ghi dữ liệu riêng offline; biểu mẫu chưa gửi chưa được lưu. Không tự động cài ứng dụng vào hệ điều hành.

Chưa chạy OS install trên iOS/Android, screen reader thật, chứng nhận WCAG, Lighthouse/Web Vitals, tải lịch sử lớn, Docker trên máy trống, CI GitHub hoặc domain HTTPS. Các kiểm tra local không thay cho các điều kiện đó. E2E toàn diện tiếp tục giai đoạn10.

## File chính

- Web: App, Modal, PageBoundary, tabs helper, AuthPage, preview Fitness/Tasks/FitnessChart, PwaStatus, global.css, vite config, sw-template, manifest/icon/offline/index.
- Tests: pwa-a11y, service-worker; cập nhật kiểm thử trang lazy và API nền tảng.
- API: app/Health và config/openapi; không thay thuật toán tiền/công việc/tập luyện.
- Scripts: seed-demo-local, check-pwa; npm scripts, CI.
- Tài liệu: README, API, DECISIONS, PHASE_9.
