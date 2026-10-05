# Giai đoạn11 — Bản chuẩn bị triển khai

Ngày05/10/2026, dự án `E:\mam-chung`. Người dùng chọn **chưa có máy chủ/tên miền, chuẩn bị bản triển khai trước**. Kết quả là bản cấu hình, công cụ và tài liệu có thể tiếp tục triển khai; chưa có website public/HTTPS thật. Không đánh dấu toàn bộ triển khai production đã hoàn thành.

## Đã làm

- Compose production độc lập: mạng database/app internal, chỉ Caddy publish80/443, authMongo/keyfile/user riêng, readiness/dependency, restart/graceful stop, log rotation, volume dữ liệu/chứng chỉ.
- API Docker multi-stage, Node24 LTS, omit devDependencies, usernode; nâng web build sangNode24 và nginx stable. Build context loại .local/env/backup/coverage.
- Caddy domain/email/HTTPS/HSTS và volume chứng chỉ. Nginx giữ forwarded HTTPS, healthz, no-storeAPI/index/SW, immutable hashedassets.
- Tạo .env.production với4secret độc lập, không ghi đè file/không insecret; từ chối input chèn dotenv hoặc URL thayhostname.
- API từ chối production JWT mẫu và CORS HTTP/path/query/hash/credentials; chuẩn hóa origin để khớp header trình duyệt. Development HTTP hoạt động như cũ; health vẫnphase10.
- Backup định kỳ mặc định24h/fulloplog/gzip/checksum, configcredential tạm, dọnpartial khi toolfail, healthlast-success. Restore checksum và cố định database thử cách ly.
- Hướng dẫn deploy/backup/restore/monitor/update; CI thêm testops và job config/build/nginx/Caddy syntax. CI chưa chạy trênGitHub, Docker container chưa được build trên máy này.

## Đã kiểm chứng hiện tại

| Kiểm tra            | Kết quả                                                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend Jest        | 244/244,11suite, gồm7test cấu hình mới                                                                                                                                                                                 |
| Coverage service    | statements98,59%; branches91,74%; functions100%; lines99,26%                                                                                                                                                           |
| Công cụ vận hành    | 9/9: tạo secret/đầu vào/không overwrite, configcredential, fulloplog/checksum, thất bại/partial, archive hỏng, restoretarget và sức khỏe backup                                                                        |
| Backup/restore thật | PASS bằng MongoDB Tools100.19.1 và Mongo7.0.14 trênWindows; hai replica set tạm, source bật auth, userbackup rolebackup, ghi transaction đồng thời; wallet796=ledger796,6giao dịch, uniqueindex và backupuser phục hồi |
| Compose CLI         | config --quiet production và restore đạt bằng DockerComposeportable5.6.0, dùng thông tin giả                                                                                                                           |
| YAML invariants     | chỉCaddy publishport; database/app/restore internal; restore không port; productionNODE_ENV đúng                                                                                                                       |
| Mã nguồn/build      | TypeScript/ESLint và npmrunbuild đạt                                                                                                                                                                                   |

Các file archive ở unit test là **fixture giả** để kiểm tra điều phối, khôngBSON. Đợt check:backup riêng bên trên dùng mongodump/mongorestore thật, archive/checksum thật và đọc kết quả từ DB phục hồi, rồi dọn haiDBtạm. Không sao lưu/ghi/xóa `.local/data` hay tài khoản demo thật.

Frontend không đổi trong giai đoạn11; kết quả150/150 ở giai đoạn10 giữ trong báo cáo giai đoạn10, không coi là lần chạy mới. PWA/build/format/diff được kiểm tra khi chốt phiên bản. File mẫu env và source ops không chứa mật khẩu thật; toolsportable/data-check giả chỉ nằm .local bị loạiGit/build.

## Còn cần khi có hạ tầng

Docker image build/startup thực, mongoinit/key permissions bên trongLinux container, nginx/Caddy runtime, DNS/certACME/gia hạn, cookieHTTPS/auth/rate-limit/proxy quaInternet, backupservice định kỳ/ngoài máy/mã hóa/monitor, restore rehearsal trênserver và nghiệm thu luồng người dùng. CI job mới chưa phải bằng chứng đã qua.

Mongo1node/keyfile/privateDockerbridge không phảiHA/TLS nội bộ hoặc hạ tầng có chứng nhận bảo mật. Bản sao cùng máy/gzip/checksum không thay backup ngoài máy có mã hóa. Chưa tự xóa backup cũ hoặc gửi cảnh báohealth. Healthbackup có thểunhealthy nhưng Docker không tự restart/notify chỉ vìhealth.

## Chạy lại và bàn giao

- `npm run test:ops`:9test vận hành nhanh, không cầnMongo/Docker.
- `npm run check:backup -- <thư-mục-tools>`: diễn tập thật trên2DBtạm; dùngMongoDBTools chính thức, không trỏDBchính.
- Từng bước triển khai và khôi phục: [DEPLOYMENT.md](DEPLOYMENT.md).
- Bản mới giữ localdev tương thích; website chính dùng dữ liệu local hiện có.

Khi đã có máy chủ/tên miền, tiếp tục nghiệm thu các mục chưa chạy; chưa cần triển khai công khai ở lần chuẩn bị này.
