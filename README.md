# Mầm Chung 🌱

Ứng dụng quản lý tài chính, công việc và tập luyện cho cá nhân/cặp đôi theo master prompt. **Đã hoàn thành giai đoạn 0–10: nền tảng, tài khoản, tài chính cá nhân, ngân sách, mục tiêu, định kỳ, báo cáo và CSV.** Couple đã có tạo/mời/ghép đôi, ngày kỷ niệm và lưu trữ. Tài chính chung đã có quỹ, đóng góp, chia tiền, công nợ hai bước và mục tiêu. Công việc cá nhân/chung, Kanban, việc con, lặp lại, bình luận và mua sắm chung đã sẵn sàng. Fitness đã có sổ buổi tập/set, ghi nhanh, mẫu, số đo, mục tiêu tuần và biểu đồ volume/rep/1RM/PR. Dashboard tổng hợp và thông báo trong ứng dụng đã có. Giai đoạn9 đã thêm PWA, cải thiện responsive/khả năng truy cập, chia gói theo trang, dữ liệu demo và Swagger. Giai đoạn 10 đã bổ sung kiểm thử luồng tích hợp và kiểm chứng trình duyệt với dữ liệu QA tách riêng. Giai đoạn11 đã chuẩn bị cấu hình triển khai và sao lưu/khôi phục; chưa đưa lên máy chủ vì chưa có máy chủ/tên miền.

## Chạy ngay trên máy (không cần Docker)

Dùng Node.js 24 LTS và npm cho bản triển khai mới.

```powershell
npm ci
npm run dev:local
```

Mở **http://127.0.0.1:5173/register** để tạo tài khoản thật trong bản local. Swagger tại http://127.0.0.1:4000/api/docs.

Lần đầu tải MongoDB 7.0.14 từ nguồn chính thức (Windows khoảng 592 MB). Replica set riêng chỉ lắng nghe loopback. Dữ liệu local lưu trong `.local/data`; khóa JWT được tạo ngẫu nhiên trong `.local/jwt-secret`. Cả hai được loại khỏi Git và Docker build context. `Ctrl+C` dừng toàn bộ hệ thống và giữ dữ liệu. Khi sửa backend, khởi động lại `dev:local`. Các cổng dùng: web 5173, API 4000, MongoDB local 27118; hãy dừng bản chạy cũ trước khi mở bản mới. Thử nghiệm Jest dùng DB riêng, không xóa DB local này.

`.local` là chế độ phát triển trên máy riêng, không phải cấu hình triển khai server. Có thể đặt `MONGOMS_DOWNLOAD_DIR` để tái sử dụng thư mục chứa binary MongoDB đã tải.

## Chức năng hiện có

- Đăng ký, đăng nhập, đăng xuất thật.
- JWT access 15 phút; refresh cookie httpOnly 7 ngày, SameSite=Strict và Secure trong production.
- Refresh rotation; phát hiện reuse thu hồi toàn bộ phiên của tài khoản.
- Khóa 15 phút sau 5 lần sai; login/register giới hạn 10 lần/phút/IP và API 100 lần/phút/IP.
- Hồ sơ: tên, URL ảnh đại diện HTTPS, múi giờ IANA.
- Đổi mật khẩu với mật khẩu hiện tại, thu hồi mọi phiên.
- Xóa tài khoản với xác nhận mật khẩu, soft delete và thu hồi mọi phiên.
- Route guard, tự làm mới token khi 401, khôi phục phiên khi tải lại, Web Locks phối hợp refresh giữa tab trên trình duyệt hỗ trợ.
- Trang `/preview` dùng dữ liệu minh họa được ghi nhãn; trang `/` sau đăng nhập không hiển thị số dư mẫu như dữ liệu thật.

- Tài chính tại `/finance`: ví tiền mặt/ngân hàng/điện tử, lưu trữ/khôi phục, đối soát.
- Thu/chi: tạo/sửa/xóa/nhân bản, ghi chú/nhãn, lọc ngày/ví/danh mục/loại, tìm kiếm, sắp xếp và phân trang.
- Chuyển tiền hai ví bằng một transaction, hai dòng liên kết, không tính vào tổng thu/chi.
- Danh mục mặc định và riêng; xóa danh mục riêng có lịch sử cần danh mục thay thế.
- Tổng quan thực: số dư mọi ví, thu/chi theo tháng và múi giờ hồ sơ, so sánh tháng trước, biểu đồ chi và giao dịch gần đây.

- Ngân sách theo danh mục chi và tháng, tiến độ thực theo sổ, nhắc 80%/100%.
- Mục tiêu tiết kiệm: hạn, màu, dành dụm, lịch sử và hoàn tác khoản ghi nhận. Tiền dành dụm là theo dõi riêng, không tự trừ ví.
- Giao dịch tuần/tháng: bật/tạm dừng, ngày kết thúc, chạy bù, thử lại kỳ thiếu tiền; khóa duy nhất để chống ghi trùng.
- Báo cáo 6/12 tháng: cột thu chi, so sánh tháng trước, xu hướng chi theo danh mục và bảng số liệu.
- Xuất CSV theo bộ lọc lịch sử, UTF-8 BOM, tối đa 10.000 dòng/lần; trường văn bản được bảo vệ trước công thức bảng tính.

- Couple tại `/couple`: tạo hành trình, mã/link mời 48 giờ một lần, ghép đôi, chuyển quyền, rời/giải tán; lịch sử lưu trữ chỉ đọc cho cả hai.
- Ngày kỷ niệm, số ngày bên nhau, nhắc trên tổng quan, bảng hoạt động cập nhật mỗi 5 giây khi mở trang.
- Trang `/invite/:code` yêu cầu đăng nhập, xem lời mời trước khi chấp nhận; chỉ chia sẻ tên/ảnh, tài chính cá nhân vẫn riêng tư.

- Tài chính chung tại `/shared`: nhiều quỹ, nạp tiền theo người góp, lịch sử, lưu trữ/khôi phục.
- Khoản chi chung trả từ quỹ hoặc ứng cá nhân; chia đều, số tiền tùy chỉnh hoặc phần trăm, tổng luôn khớp đến một đồng.
- Công nợ tự tạo từ khoản ứng: người nợ báo đã trả, người nhận xác nhận/từ chối; tổng hợp ròng và lịch sử có bộ lọc.
- Mục tiêu chung có đóng góp và hoàn tác; dashboard hiển thị số dư, chi tháng theo danh mục, công nợ và mục tiêu.
- Hành trình đã lưu trữ giữ toàn bộ sổ chung ở chế độ chỉ đọc. Ứng dụng ghi nhận tiền, không chuyển tiền ngân hàng.

- Công việc tại `/tasks`: cá nhân/chung/giao cho tôi; lọc trạng thái, ưu tiên, hạn, nhãn, tìm kiếm và sắp xếp.
- Danh sách và Kanban bốn cột; chọn trạng thái để chuyển việc, ghi thời gian hoàn thành.
- Checklist, lặp ngày/tuần/tháng, bình luận ngắn trên việc chung, danh sách mua sắm tick từng món.
- Cả hai sửa việc chung; revision bảo vệ khi sửa đồng thời. Lịch sử couple cũ chỉ đọc; việc cá nhân vẫn riêng.
- Tổng quan có việc hôm nay, quá hạn và hoàn thành nhanh theo múi giờ hồ sơ.

Chi tiết triển khai và kiểm tra: [Giai đoạn 5](docs/PHASE_5.md), [Giai đoạn 6](docs/PHASE_6.md), [Giai đoạn 7](docs/PHASE_7.md), [Giai đoạn 8](docs/PHASE_8.md), [Giai đoạn 9](docs/PHASE_9.md), [Giai đoạn 10](docs/PHASE_10.md).

## Dashboard và thông báo

Trang `/` tổng hợp số dư cá nhân, thu/chi tháng, donut chi tiêu, ngân sách, việc hôm nay/quá hạn với nút Xong, nhịp tập và hành trình chung. Một yêu cầu `/api/dashboard` cấp dữ liệu các khối. Bốn nút nhanh mở ngay biểu mẫu giao dịch, chi chung, công việc hoặc buổi tập.

Chuông trên thanh đầu trang hiển thị thông báo của tài khoản hiện tại: lời mời, công nợ, yêu cầu xác nhận tiền, việc được giao, hạn việc và ngân sách chạm/vượt 100%. Có đọc một/đọc tất cả, chỉ chưa đọc, phân trang và mở đúng mục liên quan. Dashboard/chuông tự làm mới 15 giây khi trang đang mở; không email/SMS/push. Những điều kiện đã xử lý sẽ tự ẩn; không lưu lại sự kiện thoáng qua nếu ứng dụng không đồng bộ khi điều kiện còn hiệu lực. Người nhận lời mời cần xem trước bằng mã hợp lệ trước khi nhận nhắc trong ứng dụng.

## PWA và dữ liệu demo (giai đoạn 9)

PWA chỉ đăng ký service worker trên bản build production, cần HTTPS hoặc localhost. Bản phát triển ở5173 không cài worker để tránh dùng code cũ. Icon192/512 và maskable, manifest, nút cài khi trình duyệt hỗ trợ; iOS dùng chức năng thêm vào màn hình chính của trình duyệt. Bản mới hiện nút cập nhật, hãy lưu biểu mẫu trước khi bấm.

Worker chỉ lưu danh sách tài nguyên công khai của bản build. Khi không mở được trang từ mạng, hiển thị trang mất kết nối chung; không cache API, cookie/token hoặc trang dữ liệu cá nhân. Không hỗ trợ ghi tài chính/công việc ngoại tuyến hoặc hàng đợi tự gửi. Biểu mẫu chưa gửi thành công chưa được lưu. Chỉ dùng màn hình offline sau khi cài worker và tải đủ tài nguyên lúc có mạng.

Các trang được tải theo nhu cầu, thư viện biểu đồ tách riêng. Worker tải nền toàn bộ tài nguyên công khai khi cài nên việc chia gói giảm tải lúc mở trang, không giảm tổng dung lượng tải của lần cài PWA. Chưa đo Lighthouse/Web Vitals trên thiết bị thật.

Sau khi `npm run dev:local` chạy, mở cửa sổ dòng lệnh thứ hai:

```powershell
npm run seed:demo:local
```

Lệnh chỉ gọi API loopback4000 và từ chối nếu API không ở môi trường development. Tạo hai tài khoản **minh.demo@mamchung.test** / **an.demo@mamchung.test**, cùng mật khẩu **DemoMam2026!**. Toàn bộ số tiền, công việc, số đo và lịch tập là giả. Chạy lại bổ sung mục thiếu theo tên/ghi chú, giữ mục còn tồn tại; không reset hoặc ghi đè tài khoản khác trùng email/tên không đúng. Không hỗ trợ chạy seed đồng thời hoặc dùng trên dữ liệu production. Ngày mẫu theo ngày chạy đầu tiên; chạy lại không dịch ngày các mục có sẵn.

Demo gồm ví cá nhân, thu/chi, ngân sách vượt mức, mục tiêu tiết kiệm, cặp đã ghép, quỹ chung, công nợ chờ xác nhận, công việc và sổ tập. Tài khoản `demo@mamchung.test` trước đó vẫn giữ nguyên. Xem [báo cáo giai đoạn9](docs/PHASE_9.md) để biết kết quả và giới hạn kiểm chứng.

## Chạy qua Docker

Yêu cầu Docker Compose 2.24.4 trở lên.

```powershell
Copy-Item .env.example .env
# Thay JWT_SECRET bằng chuỗi ngẫu nhiên mạnh (tối thiểu 32 ký tự).
docker compose up --build
```

Web http://localhost:8080; API/Swagger http://localhost:4000/api/docs. MongoDB dùng replica set rs0. Bản Docker chưa được chạy trên máy hiện tại vì máy chưa cài Docker.

## Chạy API riêng

Sao chép `.env.example` thành `apps/api/.env` và đặt secret. Chạy MongoDB replica set, sau đó:

```powershell
npm run dev:api
npm run dev:web
```

Giữ URL web và CORS_ORIGIN đồng nhất: mặc định http://127.0.0.1:5173. MongoDB URI ngoài Docker dùng `directConnection=true` vì thành viên replica set trong Docker mang tên `mongo`.

## Kiểm tra

```powershell
npm run lint
npm test
npm run build
npm run check:pwa
npm run format:check
```

Backend Jest/Supertest chạy MongoDB replica set riêng, yêu cầu tải binary lần đầu. Coverage service tự thu thập và bắt buộc statements/branches/functions/lines ≥80%. Frontend dùng Vitest/Testing Library để kiểm tra các form, guard và interceptor.

## Kiểm tra luồng người dùng trong môi trường riêng

```powershell
npm run build
npm run qa:local
```

Mở http://localhost:5174/register và tạo tài khoản QA giả mới. Web dùng bản build/PWA, API 4001, MongoDB 27119; database tạm riêng, không dùng `.local/data` hoặc các tài khoản demo. Giữ đúng hostname localhost để cookie/CORS đồng nhất. Nhập `q` rồi Enter để dừng QA và dọn database tạm do launcher tạo (cũng hỗ trợ `Ctrl+C`). Các cổng phải trống; không chạy hai launcher QA đồng thời. MongoDB binary đã tải được dùng lại, chưa có thì tải từ nguồn chính thức.

`npm run test:workflows` chạy 5 luồng HTTP tích hợp tự động với database riêng; chúng cũng nằm trong `npm test`. Đây là kiểm thử API, không phải chương trình E2E trình duyệt độc lập. Kịch bản trình duyệt và kết quả thực tế: [PHASE_10.md](docs/PHASE_10.md).

## Bản chuẩn bị triển khai (giai đoạn 11)

Dùng `docker-compose.prod.yml` **độc lập**, Node24 LTS, HTTPS qua Caddy, MongoDB xác thực/volume riêng và backup có oplog/checksum. API/Mongo không mở port công khai. Đã kiểm chứng công cụ sao lưu/khôi phục thực bằng database giả; Docker Engine/container/HTTPS trên server chưa được chạy.

```sh
node scripts/prepare-production.cjs app.tenmiencuaban.vn quantri@tenmiencuaban.vn
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

Thay hostname/email bằng thông tin thực và làm các bước DNS/máy chủ trong [DEPLOYMENT.md](docs/DEPLOYMENT.md). Trình tạo không in secret hoặc ghi đè file. Không dùng `.env.example` development cho production, không ghép hai Compose file. Script restore chỉ vào database thử cách ly. Cách chạy kiểm thử: `npm run test:ops`; diễn tập thật với MongoDB Tools: `npm run check:backup -- <thư-mục-chứa-mongodump-mongorestore>`.

Bằng chứng và giới hạn: [PHASE_11.md](docs/PHASE_11.md). File backup mặc định nằm trên máy chủ và chưa mã hóa; cần bảo vệ/chuyển bản sao ngoài máy theo hướng dẫn trước khi phục vụ dữ liệu thật.

## Cấu trúc và tài liệu

- `apps/web`: React 18/Vite/TypeScript, Router, Query, Zustand, Tailwind, giao diện tiếng Việt.
- `apps/api`: Express/Mongoose; route → controller → service → repository; Zod, auth, lỗi thống nhất.
- `docs/MASTER_PROMPT.md`: yêu cầu nguồn.
- `docs/DECISIONS.md`: quyết định triển khai.
- `docs/PHASE_0.md`, `docs/PHASE_1.md`, `docs/PHASE_2.md`, `docs/PHASE_3.md`, `docs/PHASE_4.md`: báo cáo từng giai đoạn.
- `docs/API.md`: API và quy ước. OpenAPI thực tế ở `/api/openapi.json`.
- `.github/workflows/ci.yml`: lint/test/build/format; chưa chạy trên GitHub vì chưa có remote.

Tiếp theo: **Chọn máy chủ và tên miền, chạy container/HTTPS, nghiệm thu trên server để hoàn thành phần triển khai thực tế của giai đoạn11.**
