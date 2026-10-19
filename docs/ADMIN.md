# SỔ TAY QUẢN TRỊ VIÊN MẦM CHUNG (ADMIN GUIDE) 🌱

> Tài liệu dành riêng cho chủ dự án và người vận hành hệ thống Mầm Chung.  
> **Nguyên tắc cốt lõi: Riêng tư tối đa – Tối thiểu quyền hạn – An toàn tuyệt đối.**

---

## 1. Triết lý & Mô hình phân quyền

Mầm Chung là không gian số vun đắp tình cảm dành cho các cặp đôi (quy mô khoảng 3–5 cặp đôi, tương đương 6–10 người sử dụng). Do đó, sự tôn trọng và bảo mật quyền riêng tư là **bất khả xâm phạm**.

### Mô hình phân quyền hệ thống

- Hệ thống chỉ có duy nhất **01 vai trò quản trị viên cấp cao (`role: "admin"`)** thuộc về chủ dự án. Mặc định mọi tài khoản đăng ký là người dùng thông thường (`role: "user"`).
- Vai trò `owner` và `member` trong không gian chung chỉ có ý nghĩa trong phạm vi một cặp đôi, hoàn toàn không có bất kỳ quyền hạn nào ở mức hệ thống.
- **Không có quyền lai**: Một tài khoản hoặc là `user`, hoặc là `admin`.
- **Không có tính năng đăng nhập thay người dùng (Impersonation)**: Quản trị viên tuyệt đối không thể đăng nhập dưới danh nghĩa của người dùng khác.
- **Không có tính năng xem hoặc chỉnh sửa nội dung người dùng**: Mã nguồn module quản trị bị cô lập hoàn toàn ở cấp kiến trúc.

---

## 2. Bảng minh bạch quyền hạn (Transparency Matrix)

| Danh mục             | Những gì Quản trị viên THẤY                                                                                                                                                                                                                          | Những gì Quản trị viên KHÔNG BAO GIỜ THẤY                                                                                                                                                                                                                                                                  |
| :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tài khoản**        | - ID tài khoản, Tên hiển thị, Email<br>- Ngày tạo tài khoản, Thời điểm đăng nhập gần nhất<br>- Trạng thái hoạt động (Hoạt động / Tạm khóa / Bị khóa mật khẩu tạm thời)<br>- Tên không gian chung đang tham gia                                       | - Mật khẩu gốc và chuỗi băm mật khẩu (`passwordHash`)<br>- Refresh token, mã phiên làm việc, token hash<br>- Múi giờ cá nhân, ảnh đại diện nguyên bản                                                                                                                                                      |
| **Không gian chung** | - ID không gian, Tên không gian<br>- Trạng thái không gian (Hoạt động / Đã lưu trữ)<br>- Danh sách thành viên trong cặp (Tên hiển thị, vai trò Owner/Member, trạng thái rời cặp)<br>- Số lượng mã mời ghép đôi còn hiệu lực                          | - **Tài chính**: Giao dịch thu/chi, số dư ví, danh mục chi tiêu, quỹ chung, các khoản công nợ/chia tiền<br>- **Công việc**: Danh sách nhiệm vụ, to-do list, ghi chú, bình luận<br>- **Sức khỏe**: Buổi tập, số đo cơ thể, cân nặng, lịch sử tập luyện<br>- **Kế hoạch**: Mục tiêu chung, sự kiện tương lai |
| **Hệ thống**         | - Tổng số lượng tài khoản & số cặp đôi<br>- Số tài khoản hoạt động trong 7 ngày qua<br>- Trạng thái cổng đăng ký tài khoản mới (Mở/Đóng)<br>- Trạng thái cho phép tạo không gian chung (Mở/Đóng)<br>- Nhật ký thao tác quản trị (`admin_audit_logs`) | - Không xem hay xuất được bất kỳ dữ liệu nội dung riêng tư nào của người dùng                                                                                                                                                                                                                              |

### Những việc Quản trị viên KHÔNG THỂ LÀM:

1. **Không thể xem hoặc can thiệp dữ liệu cá nhân**: Hệ thống được cô lập bằng ESLint `no-restricted-imports` và kiểm thử tự động `isolation.test.ts`. Module admin không có đường dẫn tới database model của finance, shared, tasks, fitness, planning.
2. **Không thể tự nâng quyền qua giao diện Web hay API**: Không có route API nào cho phép nâng cấp role. Tất cả schema Zod đăng ký/sửa hồ sơ đều là `.strict()` và loại bỏ trường `role`.
3. **Không thể gỡ quyền của Quản trị viên cuối cùng**: Script CLI và API từ chối lệnh xóa hoặc gỡ quyền nếu hệ thống chỉ còn 1 admin duy nhất, ngăn chặn tình trạng hệ thống mất quyền điều hành.

---

## 3. Quản lý Quản trị viên bằng CLI trên Server

Cấp hoặc gỡ quyền quản trị là thao tác an ninh tối cao, **chỉ thực hiện được trực tiếp trên console máy chủ thông qua CLI**:

### Lệnh chạy trên môi trường Production (VPS Docker)

```sh
# 1. Cấp quyền Quản trị viên cho một email:
docker compose --env-file .env.production -f docker-compose.prod.yml exec api node apps/api/dist/scripts/admin-grant.js --email chu-du-an@example.com

# 2. Xem danh sách tất cả các Quản trị viên hiện có:
docker compose --env-file .env.production -f docker-compose.prod.yml exec api node apps/api/dist/scripts/admin-list.js

# 3. Gỡ quyền Quản trị viên (nếu có từ 2 admin trở lên):
docker compose --env-file .env.production -f docker-compose.prod.yml exec api node apps/api/dist/scripts/admin-revoke.js --email admin-phu@example.com
```

### Lệnh chạy trên môi trường Phát triển (Local/Dev)

```sh
npm run admin:grant -- --email chu-du-an@example.com
npm run admin:list
npm run admin:revoke -- --email admin-phu@example.com
```

---

## 4. Hướng dẫn các thao tác Quản trị trên Giao diện Web

Khi đăng nhập bằng tài khoản có `role: "admin"`, thanh điều hướng bên trái (Sidebar) sẽ xuất hiện mục **Quản trị** (`/admin`).

Mọi thao tác ghi nhạy cảm trên giao diện đều yêu cầu **Xác nhận lại mật khẩu quản trị viên (Step-up Authentication)** để chống trường hợp máy tính bị quên khóa màn hình hoặc bị tấn công CSRF.

### 4.1. Tạm khóa / Mở khóa tài khoản người dùng

- **Khi nào dùng**: Khi phát hiện tài khoản có dấu hiệu bị lộ thông tin hoặc người dùng tạm thời yêu cầu đình chỉ tài khoản.
- **Hậu quả**:
  - Khi bị khóa: Toàn bộ phiên đăng nhập của người dùng bị thu hồi tức thì. Người dùng không thể đăng nhập hoặc làm mới token. Ở màn hình đăng nhập, hệ thống chỉ báo _"Tài khoản của bạn đang bị tạm khóa. Hãy liên hệ người quản trị"_ nếu mật khẩu đúng (không cho kẻ xấu dò xem tài khoản nào bị khóa).
  - Khi mở khóa: Tài khoản hoạt động lại bình thường.

### 4.2. Gỡ trạng thái tạm khóa đăng nhập do nhập sai mật khẩu (Unlock Login)

- **Khi nào dùng**: Người dùng nhập sai mật khẩu quá 5 lần liên tiếp và bị hệ thống tạm khóa 15 phút.
- **Thao tác**: Bấm nút **Gỡ khóa login** tại dòng tài khoản trong tab **Tài khoản**. Số lần nhập sai được đặt về 0 và xóa thời gian chờ, người dùng có thể thử đăng nhập lại ngay lập tức.

### 4.3. Đặt lại mật khẩu tạm thời (Reset Password)

- **Khi nào dùng**: Người dùng quên mật khẩu và nhờ người quản trị cấp lại (hệ thống không dùng email ngoài).
- **Thao tác**:
  1. Trong tab **Tài khoản**, bấm nút **Mật khẩu** tại dòng người dùng tương ứng.
  2. Nhập mật khẩu quản trị viên để xác nhận.
  3. Hệ thống sinh mật khẩu ngẫu nhiên mạnh (chuẩn CSPRNG, bcrypt 12, thu hồi mọi phiên cũ).
  4. Hộp thoại **Mật khẩu tạm thời** hiển thị duy nhất 1 lần kèm nút **Sao chép mật khẩu**.
  5. Quản trị viên gửi mật khẩu tạm này qua tin nhắn riêng tư an toàn (Zalo/Telegram cá nhân) và nhắc người dùng đổi mật khẩu ngay khi đăng nhập.

### 4.4. Xóa tài khoản người dùng (Xóa mềm an toàn)

- **Khi nào dùng**: Người dùng yêu cầu xóa tài khoản vĩnh viễn khỏi hệ thống.
- **Thao tác**:
  1. Bấm nút biểu tượng **Thùng rác** tại dòng tài khoản.
  2. Bắt buộc nhập lại chính xác email của người dùng cần xóa và mật khẩu quản trị viên.
  3. Hệ thống thực hiện:
     - Ẩn danh hóa thông tin: Email đổi thành `deleted-<id>-<timestamp>@deleted.local`, tên đổi thành `Người dùng cũ`.
     - Đặt `deletedAt = new Date()`, thu hồi mọi phiên làm việc.
     - Rời khỏi không gian chung an toàn: Nếu là chủ cặp và còn thành viên khác thì chuyển quyền chủ cặp tự động; nếu là thành viên cuối cùng thì chuyển trạng thái cặp thành `archived`. Toàn bộ dữ liệu giao dịch tài chính trong quá khứ của cặp đôi vẫn được toàn vẹn (không bị mồ côi dữ liệu).

### 4.5. Quản lý Không gian chung (Cặp đôi)

- **Chuyển quyền chủ không gian (Transfer Owner)**: Dùng khi chủ không gian không thể tiếp tục quản lý cặp hoặc theo thỏa thuận của 2 người. Quản trị viên chỉ có thể chuyển quyền sang thành viên đang hoạt động trong cùng cặp đó.
- **Lưu trữ không gian chung (Archive Couple)**: Khi cặp đôi quyết định dừng sử dụng hoặc có tranh chấp. Lưu trữ không gian sẽ thu hồi toàn bộ mã mời đang hoạt động và chuyển không gian sang trạng thái đã lưu trữ.

### 4.6. Cấu hình cổng hệ thống (Cài đặt)

Trong tab **Cài đặt**:

- **Cho phép đăng ký tài khoản mới**: Khi nhóm 3–5 cặp đôi đã tạo tài khoản xong, **hãy tắt công tắc này**. Trang đăng ký sẽ hiển thị thông báo dịu dàng: _"Hiện chưa mở đăng ký. Vui lòng quay lại sau hoặc liên hệ quản trị viên"_ và form đăng ký bị vô hiệu hóa. Backend từ chối mọi yêu cầu tạo tài khoản mới với mã lỗi `403 REGISTRATION_CLOSED`.
- **Cho phép tạo không gian chung mới**: Tắt công tắc này để tạm ngưng việc tạo thêm các cặp đôi mới ngoài kế hoạch.

### 4.7. Tra cứu Nhật ký Quản trị (Audit Log)

Trong tab **Nhật ký**:

- Mọi thao tác quản trị (Cấp/gỡ admin, khóa/mở khóa tài khoản, đặt lại mật khẩu, chuyển chủ cặp, lưu trữ cặp, thay đổi cấu hình hệ thống) đều được ghi nhận chi tiết: Thời gian, Địa chỉ IP, Quản trị viên thực hiện, Hành vi, và Dữ liệu tóm tắt.
- Dễ dàng tra cứu và đối soát khi cần thiết.

---

## 5. Lời cam kết minh bạch dành cho người dùng Mầm Chung

> _"Mầm Chung là tổ ấm số riêng tư của bạn và người thương. Không ai – kể cả người sáng lập và quản trị viên máy chủ – có quyền hạn hoặc khả năng xem, đọc hay can thiệp vào các giao dịch, ghi chép hay mục tiêu của hai bạn. Hệ thống được lập trình với cơ chế cách ly tuyệt đối để bảo vệ sự bình yên đó."_
