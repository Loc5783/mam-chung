# Chuẩn bị và vận hành bản triển khai Mầm Chung

Trạng thái 05/10/2026: đã chuẩn bị cấu hình và kiểm thử local. Người dùng chưa có máy chủ/tên miền. Chưa công bố website, chưa cấp chứng chỉ thật hoặc chạy các container production.

## Kiến trúc

Internet → Caddy HTTPS → nginx (web/PWA) → API → MongoDB replica set có xác thực. Chỉ Caddy mở80/443; MongoDB/API không publish port. Mạng database và app là internal; web không tham gia mạng database. Caddy có volume lưu chứng chỉ để giữ trạng thái khi khởi động lại.

Dockerfile API dùng Node24 LTS, hai bước build/runtime, bỏ devDependencies, chạy user node. MongoDB một thành viên và keyfile trên một máy là phương án tự quản nhỏ, không có high availability. MongoDB khuyến nghị X.509 cho quản lý xác thực nội bộ production ở mức cao hơn; khi mở rộng cần xem xét dịch vụ MongoDB có quản lý hoặc X.509/multi-node. Không đưa database lên cổng công khai.

`docker-compose.prod.yml` là file **độc lập**. Không ghép với `docker-compose.yml` development. Project production dùng tên mam-chung-prod và volume riêng; không dùng `.local/data`. File `.github/compose-syntax.yml` chỉ dành kiểm tra cú pháp CI, không dùng triển khai.

## 1. Chuẩn bị máy chủ

Cần máy chủ Linux có Docker Engine/Compose, quyền vận hành Docker, dung lượng dữ liệu và backup, DNS tên miền trỏ đúng máy chủ. Chỉ mở80/443 công khai; giới hạn SSH cho người quản trị. Nếu có bản ghiAAAA thì IPv6 cũng phải trỏ đúng; không giữAAAA sai vì có thể làm cấp chứng chỉ thất bại. Chưa có máy chủ nên cấu hình DNS và firewall phải được kiểm chứng khi triển khai thật.

Chuyển mã nguồn đã commit sang máy chủ bằng Git hoặc gói source, không copy node_modules, .local, .env hay backups. Có thể tạo gói từ máy phát triển:

```powershell
git archive --format=tar.gz --output=../mam-chung-release.tar.gz HEAD
```

Không tự chuyển tài khoản/dữ liệu demo sang production. Nếu cần di chuyển dữ liệu thật, lập đợt migration và xác minh riêng.

## 2. Tạo cấu hình riêng trên máy chủ

Chạy từ thư mục source. Thay hostname và email bằng thông tin thực; ví dụ dưới đây chỉ là mẫu:

```sh
node scripts/prepare-production.cjs app.tenmiencuaban.vn quantri@tenmiencuaban.vn
```

Dùng Node24. Nếu máy chủ chỉ cài Docker, có thể chạy trình tạo bằng container Node chính thức:

```sh
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:24-bookworm-slim node scripts/prepare-production.cjs app.tenmiencuaban.vn quantri@tenmiencuaban.vn
```

Tạo `.env.production` với JWT và ba mật khẩu ngẫu nhiên riêng, không in secret, không ghi đè file tồn tại, mode600 trên Linux. Domain không chứa scheme/path/port; mật khẩu được tạo bằng base64url để an toàn trong URI và dotenv. Kiểm tra ACL riêng nếu tạo trên Windows. File này và backups bị loại khỏi Git/build context.

Giữ cấu hình riêng và keyfile MongoDB trong kho bí mật có bảo vệ. Init không đổi mật khẩu của user đã tồn tại: sửa .env hoặc tạo lại file ngẫu nhiên không tự đổi user MongoDB. Khi cần xoay secret, thực hiện thủ tục riêng; đổi JWT làm các phiên hiện có không còn hợp lệ.

## 3. Kiểm tra và khởi động

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

`config --quiet` kiểm tra cấu hình mà không in các secret đã thay thế. Không đưa output đầy đủ của `config`, inspect hoặc .env lên chat/log công khai. Cấu hình yêu cầu secret/domain/email, API từ chối JWT mẫu và CORS không phải origin HTTPS.

Trình tạo key chỉ chạy lần đầu, mode400/owner999 của image Mongo7; Mongo tạo root admin từ volume mới, init chờ primary rồi tạo mam_app chỉ readWrite database mam_chung và mam_backup có role backup. API chỉ chạy sau init, web/Caddy chờ API/web healthy. Init được chạy lại an toàn theo user có sẵn, không thay credential. Không dùng volume Mongo cũ không xác thực cho cấu hình mới này.

Caddy tự xin/gia hạn HTTPS theo domain/email đã đặt. TLS thực phụ thuộc DNS,80/443, kết nối Internet và ACME; chưa kiểm chứng trên máy này. TRUST_PROXY_HOPS=2 tương ứng Caddy→nginx→API; nginx giữ forwarded HTTPS từ Caddy. Không mở API trực tiếp hoặc thêm CDN/proxy khác mà giữ nguyên giả định này. Service worker/index/API có Cache-Control tránh dùng bản cũ hoặc cache dữ liệu riêng; asset có hash được cache dài hạn.

Sau khi tất cả service sẵn sàng:

```sh
curl -fsS https://app.tenmiencuaban.vn/healthz
curl -fsS https://app.tenmiencuaban.vn/api/health
```

- `healthz` là nginx, không thay thế readiness database.
- `/api/health`: Ở production, API chỉ trả về `{ "status": "ok" }` (mã 200 khi kết nối MongoDB tốt, mã 503 khi mất kết nối database). Để bảo mật, API ẩn toàn bộ phase, tên môi trường và thông tin phiên bản nội bộ.
- **Swagger / OpenAPI (`/api/docs`)**: Mặc định ở `NODE_ENV=production`, trang tài liệu `/api/docs` bị vô hiệu hóa (trả mã 404). Nếu người quản trị cần mở lại trang tài liệu này trên máy chủ thật, đặt biến môi trường `ENABLE_API_DOCS=true` trong file `.env.production`.
- Kiểm tra HTTP tự chuyển sang HTTPS, cookie refresh HttpOnly/Secure/SameSite=Strict, đăng ký/đăng nhập/tải lại/đăng xuất, ví và rollback, riêng tư giữa hai người, quỹ/công nợ, task, Fitness, PWA. Chỉ dùng dữ liệu giả cho vòng nghiệm thu.

## 4. Sao lưu định kỳ

Service backup chạy ngay khi init xong, lặp sau mỗi BACKUP_INTERVAL_SECONDS (mặc định24 giờ sau lần chạy trước). Dùng tài khoản backup, full dump replica set có `--oplog`, gzip và SHA256; không lọc database/namespace vì sẽ không còn phù hợp với oplog. URI nằm trong config file tạm mode600, không xuất hiện trong argv hoặc log. File partial được dọn khi chạy thất bại; archive chỉ được công bố sau dump thành công, kèm checksum và last-success.json. Có thể để lại partial khi máy mất điện; restore bỏ qua chúng.

Backup đầy đủ có thể chứa dữ liệu cá nhân và thông tin xác thực database. File trên disk có quyền hạn chế, **gzip không mã hóa**, SHA256 chỉ phát hiện lỗi nội dung khi checksum gốc còn tin cậy. Mã hóa và chuyển bản sao sang vị trí ngoài máy chủ bằng công cụ/kho bí mật của người quản trị; không gửi các archive qua chat. Backup trên cùng máy không bảo vệ khi cả máy/ổ đĩa mất. Bản mặc định không tự upload hoặc tự xóa backup cũ; cần chính sách giữ bản theo dung lượng và yêu cầu sử dụng.

Tạo một bản thủ công:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps backup node /ops/backup.cjs
```

Theo dõi:

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml ps backup
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=50 backup
cat backups/last-success.json
du -sh backups
```

Health backup unhealthy khi không có bản hoàn chỉnh hoặc bản cuối quá cũ (hơn2× khoảng). Docker health không tự gửi cảnh báo và cũng không tự restart chỉ vì unhealthy; người quản trị phải gắn giám sát/nhắc cảnh báo thực khi có hạ tầng. Mất backup có thể tăng khoảng dữ liệu mất vượt24 giờ. Thử khôi phục định kỳ và sau thay đổi phiên bản Mongo/Tools; không chỉ xem file tồn tại.

## 5. Khôi phục thử vào database cách ly

Không dùng archive không có checksum hoặc sai checksum. Chọn đúng basename do script sinh:

```sh
export RESTORE_FILE=mam-chung-20261005T000000000Z-aabbccdd.archive.gz
docker compose -f infra/restore-check.yml config --quiet
docker compose -f infra/restore-check.yml build restore
docker compose -f infra/restore-check.yml up -d mongo-restore
docker compose -f infra/restore-check.yml run --rm restore
```

File và checksum nằm trong backups của source, được mount chỉ đọc. Project mam-chung-restore-check có mạng internal, không port công khai, volume restore_data riêng. Script cố định đích mongo-restore và `--oplogReplay`, không cho truyền URI production. Dùng volume thử **mới/empty** cho mỗi vòng; restore-init dành cho replica set mới, không phải migration. Không chạy hai đợt thử cùng project.

Sau khi restore thành công, kiểm tra trên container thử đang chạy:

```sh
docker compose -f infra/restore-check.yml exec mongo-restore mongosh mam_chung
```

Đối chiếu số bản ghi, số dư ví với ledger, dữ liệu chung, user/index và phiên bản Mongo/FCV. Container phục hồi này chưa bật auth để quản trị kiểm tra dữ liệu; mạng cách ly không thể truy cập ngoài. Chỉ vận hành trong môi trường thử có kiểm soát. Khi kết thúc, dừng project thử; việc xóa volume thử phải đúng project và chỉ khi không còn cần dữ liệu kiểm tra. Không chạy `down -v` trên project production.

Khôi phục production cần maintenance, dừng ghi, bảo toàn bản hiện tại, kiểm chứng archive bằng đợt thử trên, kiểm tra phiên bản và kế hoạch chuyển database/credential, rồi nghiệm thu mới mở lại. Không cung cấp lệnh tự động ghi đè database đang phục vụ để tránh áp dụng nhầm bản backup.

## 6. Cập nhật và kiểm tra vận hành

Trước cập nhật: lấy bản backup mới, thử restore, lưu commit/image/secret hiện hành. Khởi động lại từ source mới bằng up --build -d; không xóa volume. Kiểm tra readiness và các luồng giả sau cập nhật. Nếu có thay đổi schema/data thì rollback image có thể không đủ: cần kế hoạch migration và phục hồi dữ liệu.

Log service giới hạn10MB×3 mỗi container; theo dõi dung lượng backups/database, health, chứng chỉ, rate limit và lỗi DB. Không có lịch tự cập nhật image đang chạy; kiểm tra image/security định kỳ và chốt digest khi phát hành thực. Một replica Mongo duy nhất không thay thế HA, backup ngoài máy hoặc phục hồi đã diễn tập.

## 7. Quên mật khẩu và đặt lại mật khẩu người dùng

Ứng dụng phục vụ nhóm nhỏ (3–5 cặp), không dùng dịch vụ gửi email bên ngoài nhằm tối giản chi phí và tránh rò rỉ qua email trung gian. Khi người dùng quên mật khẩu, người quản trị máy chủ thực hiện cấp lại mật khẩu tạm thông qua công cụ CLI nội bộ.

### Lệnh chạy trên máy chủ Production

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml exec api node apps/api/dist/scripts/admin-reset-password.js --email <email_nguoi_dung>
```

### Lệnh chạy ở môi trường phát triển (Local/Dev)

```sh
npm run admin:reset-password -- --email <email_nguoi_dung>
```

### Quy trình và nguyên tắc an toàn

1. **Xác minh người yêu cầu**: Luôn xác minh đúng người thân/bạn bè yêu cầu qua kênh tin cậy trực tiếp trước khi chạy lệnh.
2. **Cơ chế hoạt động**:
   - Tìm kiếm người dùng theo email (chuẩn hóa không phân biệt chữ hoa/thường, cắt khoảng trắng).
   - Tự động sinh mật khẩu tạm thời ngẫu nhiên đạt chuẩn CSPRNG (độ dài ≥ 16 ký tự, có đủ chữ và số).
   - Băm mật khẩu bằng thuật toán bcrypt (cost 12) và lưu vào database.
   - Thu hồi toàn bộ refresh token và phiên làm việc trước đó trên tất cả thiết bị; mở khóa tài khoản nếu đang bị tạm khóa do nhập sai trước đó.
3. **Bảo mật mật khẩu tạm**:
   - Mật khẩu tạm chỉ in ra màn hình terminal **một lần duy nhất**, không ghi vào hệ thống log của máy chủ.
   - Người quản trị gửi mật khẩu tạm này qua tin nhắn riêng tư an toàn cho người dùng.
   - Nhắc người dùng đăng nhập và truy cập trang **Cài đặt** để đổi sang mật khẩu riêng của mình ngay lập tức.

## Bằng chứng kiểm tra và nguồn

Xem PHASE_11.md cho phân biệt giữa đã kiểm chứng local và chưa chạy trên Docker/server. Cách dump/restore có oplog theo [MongoDB Tools](https://www.mongodb.com/docs/database-tools/mongodump/) và [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/). Xác thực nội bộ và giới hạn keyfile: [MongoDB](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-with-keyfile-access-control/). Startup health theo [Docker](https://docs.docker.com/compose/how-tos/startup-order/); xử lý forwarded headers theo [Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). Dòng Node20 đã EOL nên runtime chuyển Node24 LTS theo [lịch phát hành Node.js](https://github.com/nodejs/Release/blob/main/README.md).
