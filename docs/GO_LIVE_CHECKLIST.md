# SỔ TAY GO-LIVE: ĐƯA MẦM CHUNG LÊN SERVER THẬT 🌱

> Bản hướng dẫn từng bước ngắn gọn, thực tế dành cho chủ dự án (không yêu cầu chuyên sâu về DevOps).  
> Dùng cho quy mô 3–5 cặp đôi (khoảng 10 người sử dụng) với tiêu chí: **Bảo mật chắc chắn, chi phí tiết kiệm, dễ vận hành**.

---

## BƯỚC 1: BẢO MẬT GITHUB TRƯỚC TIÊN (LÀM TRÊN TRÌNH DUYỆT)

Vì repository `Loc5783/mam-chung` là **PUBLIC**, việc bảo vệ tài khoản GitHub là chốt chặn quan trọng nhất:

1. **Bật xác thực hai yếu tố (2FA):**
   - Vào GitHub > **Settings** > **Password and authentication** > Bật **Two-factor authentication** (dùng Google Authenticator hoặc 1Password).
2. **Bật Secret Scanning & Push Protection:**
   - Vào Repo GitHub > **Settings** > **Code security and analysis**.
   - Bật **Secret scanning** và tích chọn **Push protection** (để GitHub tự động chặn nếu ai đó vô tình commit chuỗi mật khẩu/token vào mã nguồn).
3. **Bật Dependabot alerts:**
   - Trong cùng trang **Code security and analysis**, bật **Dependabot alerts** và **Dependabot security updates** để nhận cảnh báo khi thư viện có bản vá an ninh.
4. **Bảo vệ nhánh `main`:**
   - Vào Repo GitHub > **Settings** > **Branches** > Thêm Rule cho `main`:
     - Tích chọn: _Require a pull request before merging_.
     - Tích chọn: _Require status checks to pass before merging_ (chọn kiểm tra CI).

---

## BƯỚC 2: CHUẨN BỊ MÁY CHỦ (VPS) & TÊN MIỀN

1. **Chọn VPS:**
   - Cấu hình khuyến nghị: 2 vCPU, 2GB–4GB RAM, 40GB SSD (ví dụ: Hetzner, DigitalOcean, Linode, OVH hoặc Vietnix).
   - Hệ điều hành: **Ubuntu 24.04 LTS** (hoặc Debian 12).
2. **Cấu hình Tên miền (DNS):**
   - Mua một tên miền riêng (ví dụ: `mamchung.vn` hoặc dùng subdomain `app.tenban.vn`).
   - Vào trang quản lý DNS của tên miền, tạo bản ghi:
     - **Bản ghi A:** Tên `@` (hoặc `app`) trỏ về **Địa chỉ IPv4** của VPS.
     - _(Nếu có IPv6)_: Tạo **Bản ghi AAAA** trỏ về IPv6 của VPS. Nếu không chắc chắn, hãy xóa bản ghi AAAA để tránh Caddy bị lỗi khi cấp SSL.
3. **Mở cổng tường lửa trên VPS:**
   - SSH vào VPS: `ssh root@<ip_vps>`
   - Mở đúng 3 cổng cần thiết:
     ```sh
     ufw allow 22/tcp    # Cổng SSH để bạn quản trị
     ufw allow 80/tcp    # Cổng HTTP (Caddy tự cấp chứng chỉ SSL)
     ufw allow 443/tcp   # Cổng HTTPS bảo mật
     ufw enable
     ```

---

## BƯỚC 3: CÀI ĐẶT DOCKER & TẢI MÃ NGUỒN

Chạy các lệnh sau trên terminal của VPS:

```sh
# 1. Cài đặt Docker và Docker Compose chính thức
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Cài đặt Git và tải mã nguồn dự án
git clone https://github.com/Loc5783/mam-chung.git
cd mam-chung
git checkout main
```

---

## BƯỚC 4: SINH FILE CẤU HÌNH BÍ MẬT `.env.production`

Không tự gõ mật khẩu bằng tay! Hãy dùng script có sẵn để sinh chuỗi ngẫu nhiên chuẩn quân sự:

```sh
# Thay "app.tenmiencuaban.vn" và email quản trị của bạn:
node scripts/prepare-production.cjs app.tenmiencuaban.vn email-cua-ban@gmail.com
```

> **Ghi chú quan trọng:**
>
> - Lệnh trên sẽ tự động tạo file `.env.production` chứa `JWT_SECRET`, mật khẩu MongoDB admin, mật khẩu app và mật khẩu backup độc lập.
> - File này được gán quyền riêng tư `chmod 600` (chỉ root mới đọc được) và đã nằm trong `.gitignore` nên **không bao giờ bị lộ ra ngoài**.

---

## BƯỚC 5: KHỞI ĐỘNG ỨNG DỤNG BẰNG DOCKER COMPOSE

Chạy lệnh kiểm tra cấu hình và khởi động toàn bộ hệ thống:

```sh
# 1. Kiểm tra cú pháp cấu hình an toàn (không in mật khẩu)
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet

# 2. Build và khởi động ở chế độ chạy nền
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d

# 3. Xem trạng thái các container (phải hiện "Up" hoặc "healthy")
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

---

## BƯỚC 6: KIỂM TRA HEADER BẢO MẬT & HEALTHCHECK

Ngay trên VPS hoặc trên máy tính cá nhân của bạn, kiểm tra xem máy chủ đã an toàn chưa:

1. **Kiểm tra Healthcheck:**
   ```sh
   curl -fsS https://app.tenmiencuaban.vn/api/health
   # Kết quả đúng: {"status":"ok"}
   ```
2. **Kiểm tra Header bảo mật bằng `curl`:**
   ```sh
   curl -sI https://app.tenmiencuaban.vn
   ```
   **Dấu hiệu đạt chuẩn an ninh:**
   - Có `strict-transport-security` (HSTS).
   - Có `content-security-policy` (CSP chặt chẽ, không có unsafe-inline cho script).
   - Có `x-frame-options: DENY` (chống nhúng web lừa đảo click-jacking).
   - Có `x-content-type-options: nosniff`.
   - Trang Swagger `/api/docs` khi truy cập phải trả về **404 Not Found** (an toàn, không lộ tài liệu nội bộ).

---

## BƯỚC 7: TẠO TÀI KHOẢN ĐẦU TIÊN & TRẢI NGHIỆM

1. Mở trình duyệt trên điện thoại hoặc máy tính: `https://app.tenmiencuaban.vn/register`
2. Tạo tài khoản cho bạn và người thương:
   - Nhập Họ tên, Email thật, và Mật khẩu mạnh (ít nhất 8 ký tự, có chữ và số).
3. Đăng nhập thành công > Vào mục **Cặp đôi** > Tạo hành trình và gửi mã mời cho đối phương.
4. Bật PWA: Bấm nút "Cài đặt ứng dụng" trên thanh địa chỉ trình duyệt hoặc "Thêm vào màn hình chính" trên iPhone/Android để dùng như app di động.

---

## BƯỚC 8: CẤP QUYỀN QUẢN TRỊ VIÊN & KHÓA CỔNG ĐĂNG KÝ

1. **Cấp quyền Admin cho tài khoản của bạn (Chủ dự án):**
   Chạy lệnh CLI trực tiếp trên VPS:
   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml exec api node apps/api/dist/scripts/admin-grant.js --email <email_cua_ban>
   ```
2. **Kiểm tra giao diện Quản trị:**
   - Tải lại trang web Mầm Chung trên trình duyệt: Thanh Sidebar bên trái sẽ xuất hiện mục **Quản trị** (`/admin`).
   - Bấm vào mục **Quản trị** để xem 5 tab: **Tổng quan**, **Tài khoản**, **Không gian chung**, **Cài đặt**, **Nhật ký**.
   - Kiểm tra tài khoản của đối phương (không có quyền admin): Đăng nhập không thấy mục Quản trị trên sidebar, cố tình gõ `/admin` trên URL sẽ tự động bị đá về trang chủ `/`.
3. **Đóng cổng đăng ký tài khoản mới khi hoàn tất mời bạn bè:**
   - Sau khi các cặp đôi (3–5 cặp) đã tạo xong tài khoản:
     Vào **Quản trị** > **Cài đặt** > Bấm tắt **Cho phép đăng ký tài khoản mới** (nhập mật khẩu admin để xác nhận).
   - Kiểm tra: Mở tab ẩn danh truy cập `https://app.tenmiencuaban.vn/register` sẽ thấy banner dịu dàng _"Hiện chưa mở đăng ký. Vui lòng quay lại sau hoặc liên hệ quản trị viên"_ và form tạo tài khoản bị khóa hoàn toàn.
4. **Kiểm tra Rate Limiter của Admin:**
   - Các route `/api/admin/*` được bảo vệ độc lập ở mức 60 lượt gọi/phút/IP.

---

## BƯỚC 9: DIỄN TẬP ĐẶT LẠI MẬT KHẨU BẰNG CLI (KHI QUÊN MẬT KHẨU)

Khi có người trong nhóm (hoặc chính bạn) quên mật khẩu, bạn có 2 cách xử lý:

- **Cách 1 (Qua giao diện Web):** Vào **Quản trị** > **Tài khoản** > Bấm **Mật khẩu** > Nhập mật khẩu admin > Copy mật khẩu tạm gửi riêng cho họ.
- **Cách 2 (Qua Terminal VPS):** Chạy lệnh CLI:
  ```sh
  docker compose --env-file .env.production -f docker-compose.prod.yml exec api node apps/api/dist/scripts/admin-reset-password.js --email <email_nguoi_quen_mat_khau>
  ```

**Quy trình chuẩn:**

1. Màn hình sẽ hiển thị duy nhất một lần mật khẩu tạm thời ngẫu nhiên (ví dụ: `k8Fq#9xL2pW!vZaM`).
2. Bạn gửi mật khẩu này qua tin nhắn riêng (Zalo/Telegram cá nhân) cho họ.
3. Nhắc họ đăng nhập vào web ngay, vào **Cài đặt** > **Đổi mật khẩu** sang mật khẩu riêng của họ.

---

## BƯỚC 10: DIỄN TẬP SAO LƯU & KHÔI PHỤC THỬ NGHIỆM

Hệ thống đã có service backup tự động chạy ngầm mỗi 24 giờ. Tuy nhiên, trước khi dùng thật, bạn **bắt buộc phải diễn tập khôi phục 1 lần**:

1. **Chạy tạo bản backup thủ công ngay lập tức:**
   ```sh
   docker compose --env-file .env.production -f docker-compose.prod.yml run --rm --no-deps backup node /ops/backup.cjs
   ```
2. **Xem file backup vừa sinh:**
   ```sh
   cat backups/last-success.json
   # Sẽ thấy tên file dạng: mam-chung-2026...archive.gz
   ```
3. **Chạy khôi phục thử nghiệm vào container cách ly:**
   ```sh
   export RESTORE_FILE=$(jq -r .filename backups/last-success.json)
   docker compose -f infra/restore-check.yml run --rm restore
   ```
   **Kết quả đạt:** Màn hình báo _Archive restored to isolated mongo-restore successfully_.

---

## BƯỚC 11: QUY TRÌNH NÂNG CẤP KHI CÓ BẢN CODE MỚI

Mỗi khi bạn commit code mới lên GitHub và muốn cập nhật web trên VPS:

```sh
cd ~/mam-chung
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

_(Dữ liệu cũ trong MongoDB hoàn toàn được giữ nguyên vẹn qua các lần build)._

---

Chúc bạn và các cặp đôi có một hành trình vun đắp thật ấm áp và bình yên cùng Mầm Chung! 🌱
