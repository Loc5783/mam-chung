# MASTER PROMPT — XÂY DỰNG "MẦM CHUNG" (FULL-STACK)

> Cách dùng: dán toàn bộ nội dung bên dưới vào Claude Code (hoặc AI lập trình khác) ở thư mục repo trống. Yêu cầu AI làm **từng giai đoạn** theo mục 17, xong mỗi giai đoạn phải chạy test và báo cáo rồi mới sang giai đoạn tiếp theo.

---

## 0. VAI TRÒ VÀ CÁCH LÀM VIỆC

Bạn là một Senior Full-stack Engineer kiêm UI/UX designer. Hãy xây dựng cho tôi một ứng dụng web full-stack hoàn chỉnh, chạy được trên production, tên là **Mầm Chung (Seedling Together)**.

Quy tắc làm việc bắt buộc:

1. Viết **code đầy đủ, chạy được**. Không để `// TODO`, không viết giả (pseudo-code), không bỏ lửng "phần còn lại tương tự".
2. Làm theo **giai đoạn** ở mục 17. Hết mỗi giai đoạn: chạy lint + test, tóm tắt những gì đã làm, liệt kê file đã tạo, rồi dừng chờ tôi xác nhận.
3. Mọi quy tắc nghiệp vụ phải được thực thi ở **tầng Service ở backend**, không chỉ dựa vào frontend hay database.
4. Không bao giờ tin dữ liệu từ client: `userId` và `coupleId` luôn lấy từ token đã xác thực.
5. Khi gặp điểm mơ hồ trong tài liệu này, chọn phương án an toàn nhất, ghi quyết định vào `docs/DECISIONS.md` rồi tiếp tục (đừng dừng lại hỏi vụn vặt).
6. Giao diện, nhãn, thông báo lỗi, dữ liệu mẫu: **tiếng Việt**. Tên biến/hàm/commit: tiếng Anh.
7. Commit theo convention: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

---

## 1. TỔNG QUAN SẢN PHẨM

**Mầm Chung** là ứng dụng web cho cá nhân và các cặp đôi, gồm 6 nhóm chức năng:

1. Quản lý tài chính cá nhân (ví, giao dịch, danh mục, báo cáo).
2. Kết nối cặp đôi (tạo couple, mời, chấp nhận, rời).
3. Quản lý tài chính chung (quỹ chung, chi tiêu chung, chia tiền, công nợ, hoàn tiền).
4. Quản lý công việc (Todo) cá nhân và chung, có phân công, hạn chót, ưu tiên.
5. Theo dõi tập luyện (Fitness): bài tập, buổi tập, set, tiến độ, phân tích cường độ.
6. Dashboard tổng hợp.

Mục tiêu: MVP chạy production, hai người dùng truy cập đồng thời, dữ liệu nhất quán.

### Ngoài phạm vi (KHÔNG làm)
AI tư vấn, chat/tin nhắn thời gian thực, app mobile native, cổng thanh toán, gửi email/SMS, mạng xã hội, hệ thống đề xuất. (Giao diện responsive và cài được dạng PWA thì được làm.)

---

## 2. TECH STACK (BẮT BUỘC)

**Frontend**
- React 18 + Vite + TypeScript
- React Router v6, TanStack Query (server state), Zustand (UI/auth state)
- Tailwind CSS (cấu hình theme riêng theo mục 3), Recharts (biểu đồ), lucide-react (icon)
- react-hook-form + zod (form + validation), date-fns (ngày, locale `vi`)
- Vitest + React Testing Library

**Backend**
- Node.js 20 + Express + TypeScript
- MongoDB + Mongoose. **Phải chạy replica set** (vì cần multi-document transaction)
- Zod (validate body/query/params), jsonwebtoken, bcrypt (cost ≥ 10), helmet, cors, express-rate-limit, cookie-parser, pino (log), swagger-ui-express (OpenAPI)
- Jest + Supertest + mongodb-memory-server (replica set mode)

**Hạ tầng**
- Docker + Docker Compose (frontend nginx, backend, mongo replica set 1 node)
- Reverse proxy có HTTPS (Caddy hoặc nginx + Let's Encrypt)
- GitHub Actions CI (lint + test + build)

---

## 3. THIẾT KẾ GIAO DIỆN (DESIGN SYSTEM)

### 3.1 Bảng màu (đúng 3 màu chính)
| Token | Hex | Dùng cho |
|---|---|---|
| `--primary` (xanh cốm, màu chủ đạo) | `#7E9B57` | nút chính, nav đang chọn, điểm nhấn |
| `--primary-dark` | `#57713A` | hover, chữ trên nền xanh nhạt |
| `--primary-light` | `#E7EFDB` | nền badge, hover nhẹ |
| `--primary-lighter` | `#F2F6EA` | nền khối phụ |
| `--pink` | `#E38FA9` | nút/thẻ khu vực cặp đôi, chi tiêu, cảnh báo nhẹ |
| `--pink-dark` | `#B3577A` | hover, chữ trên nền hồng nhạt |
| `--pink-light` | `#FBE6ED` | nền badge hồng |
| `--bg` (trắng ngà) | `#FAFBF6` | nền trang |
| `--surface` (trắng) | `#FFFFFF` | thẻ card |
| `--ink` / `--ink-muted` | `#2B3324` / `#75806B` | chữ |
| `--border` | `#E4E8D9` | viền |
| `--danger` | `#D2664F` | lỗi/xóa (chỉ dùng cho trạng thái lỗi) |

Quy tắc: xanh cốm chiếm ~60% điểm nhấn, hồng ~25% (dành cho khu vực "cặp đôi / chung" và chi tiêu), trắng làm nền. Không thêm màu chủ đạo khác. Cấu hình các token trên trong `tailwind.config` và CSS variables.

### 3.2 Typography và phong cách
- Heading: **Fraunces** (serif mềm, ấm). Body/UI: **Be Vietnam Pro** (hỗ trợ tiếng Việt tốt).
- Bo góc lớn (card 16px, nút/input 10px), viền mảnh, bóng rất nhẹ hoặc không bóng.
- Logo: icon mầm cây (Sprout) nền xanh cốm. Cảm giác: ấm, sạch, nhẹ, thân thiện với cặp đôi.
- Số tiền dùng định dạng `1.234.567 đ`; ngày `dd/MM/yyyy`.

### 3.3 Yêu cầu UX
- Responsive: desktop (sidebar cố định), tablet, mobile (bottom navigation 5 mục + nút "+" nhanh).
- Có trạng thái **loading (skeleton), empty state (có nút hành động), error** cho mọi danh sách.
- Toast thông báo thành công/thất bại; hộp thoại xác nhận trước khi xóa.
- Form hiển thị lỗi validation ngay dưới từng ô; không dùng `alert()`.
- Hỗ trợ bàn phím, focus ring rõ, `aria-label` cho nút icon, tôn trọng `prefers-reduced-motion`.
- Cấu hình PWA cơ bản (manifest + icon) để thêm vào màn hình chính điện thoại.

---

## 4. KIẾN TRÚC

```
mam-chung/
├─ apps/
│  ├─ web/                  # React + Vite
│  │  └─ src/
│  │     ├─ app/            # router, providers, layout (Sidebar, BottomNav, Topbar)
│  │     ├─ components/ui/  # Button, Input, Select, Modal, Card, Badge, Toast, Skeleton, EmptyState, ConfirmDialog
│  │     ├─ features/       # auth, wallets, transactions, categories, budgets, goals,
│  │     │                  # couple, shared-finance, tasks, fitness, dashboard, notifications, settings
│  │     ├─ lib/            # apiClient (axios + refresh interceptor), format, queryClient
│  │     └─ styles/
│  └─ api/                  # Express
│     └─ src/
│        ├─ config/         # env (validate bằng zod), db, logger
│        ├─ middlewares/    # auth, validate, errorHandler, rateLimit, requireCouple
│        ├─ modules/<name>/ # model, schema (zod), controller, service, repository, routes, tests
│        ├─ utils/          # money, dates, pagination, AppError
│        └─ seeds/          # categories, exercises mặc định
├─ docs/                    # DECISIONS.md, API.md (hoặc openapi.yaml), ERD
├─ docker-compose.yml, docker-compose.prod.yml
├─ .env.example, .gitignore, README.md
└─ .github/workflows/ci.yml
```

Phân tầng bắt buộc ở backend: **route → controller (mỏng) → service (toàn bộ nghiệp vụ + transaction) → repository/model**.
Dữ liệu tách bạch: Personal (một user) / Shared (chỉ khi thuộc couple active) / Todo (cá nhân hoặc chung) / Fitness (hoàn toàn cá nhân).

### Quy ước chung
- **Tiền: lưu số nguyên VND** (không dùng float). Mọi phép tính tiền dùng helper trong `utils/money`.
- Mọi collection có `createdAt`, `updatedAt`. Dữ liệu quan trọng dùng **soft delete** (`deletedAt`) để khôi phục được.
- Response lỗi thống nhất: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`.
- Phân trang: `?page=1&limit=20`, trả `{ items, total, page, limit }`.
- Mọi endpoint (trừ register/login/refresh) yêu cầu xác thực.

---

## 5. XÁC THỰC VÀ NGƯỜI DÙNG

**Chức năng**
- Đăng ký (email, mật khẩu, tên), đăng nhập, đăng xuất, refresh token, xem/sửa profile (tên, avatar, múi giờ), **đổi mật khẩu**, **xóa tài khoản** (yêu cầu nhập lại mật khẩu).
- Màn hình: Đăng nhập, Đăng ký, Hồ sơ/Cài đặt.

**Yêu cầu kỹ thuật**
- Mật khẩu: bcrypt cost ≥ 10; tối thiểu 8 ký tự, có chữ và số.
- Access token JWT sống **15 phút**, gửi qua header `Authorization: Bearer`. Refresh token sống 7 ngày, lưu trong **httpOnly cookie (SameSite=Lax/Strict, Secure ở production)**, lưu bản **hash** trong DB để thu hồi; **xoay vòng (rotation)** mỗi lần refresh, phát hiện tái sử dụng token cũ thì thu hồi toàn bộ phiên.
- Middleware auth gắn `req.user = { id, coupleId | null }` (coupleId tra từ DB, không lấy từ client).
- Rate limit: login/register 5–10 lần/phút/IP; API chung 100 request/phút/IP. Khóa tạm tài khoản sau nhiều lần đăng nhập sai liên tiếp.
- Frontend: interceptor tự refresh khi 401, route guard, tự đăng xuất khi refresh thất bại.

---

## 6. TÀI CHÍNH CÁ NHÂN

### 6.1 Ví (Wallet)
- Nhiều ví/user; loại: `cash | bank | ewallet`; tiền tệ mặc định VND; có thể đặt màu/icon.
- CRUD. Xóa ví chỉ khi chưa có giao dịch (nếu có → gợi ý "lưu trữ ví" (archive) thay vì xóa).
- `balance` được cập nhật **nguyên tử** cùng giao dịch trong một DB transaction; có endpoint/ lệnh **đối soát** (tính lại balance từ toàn bộ giao dịch) để kiểm tra lệch.
- Tính năng thêm: **chuyển tiền giữa hai ví** của cùng user (tạo 2 bản ghi liên kết, không tính vào thu/chi).

### 6.2 Giao dịch (Transaction)
- Trường: loại (`income|expense`), số tiền (> 0, số nguyên), ví, danh mục, ngày, mô tả, ghi chú/tag (tùy chọn).
- Thu → cộng số dư ví; Chi → trừ số dư ví. **Mặc định không cho chi vượt số dư** (lỗi 422); cho phép bật tùy chọn "cho phép âm" ở từng ví.
- Sửa/xóa giao dịch → hoàn nguyên và áp dụng lại số dư đúng trong cùng transaction. Sửa đổi ví/số tiền/loại đều phải xử lý chính xác.
- Tính năng thêm: **giao dịch định kỳ** (hằng tuần/tháng: lương, tiền nhà, hóa đơn; chạy bằng cron/job khi server khởi động và mỗi ngày), **nhân bản giao dịch**, **xuất CSV**.

### 6.3 Danh mục (Category)
- Danh mục hệ thống (seed): Ăn uống, Di chuyển, Mua sắm, Hóa đơn, Giải trí, Sức khỏe, Giáo dục, Lương, Thưởng, Khác… kèm icon.
- User tự tạo/sửa/xóa danh mục riêng (thu/chi). Không cho xóa danh mục hệ thống; xóa danh mục đang có giao dịch thì phải chọn danh mục thay thế.

### 6.4 Lịch sử và tìm kiếm
Lọc theo khoảng ngày, danh mục, ví, loại; tìm theo mô tả; sắp xếp theo ngày/số tiền; phân trang; hiển thị tổng thu/chi của kết quả đang lọc.

### 6.5 Tính năng thêm (hữu ích cho dự án)
- **Ngân sách theo danh mục theo tháng** (budget): thanh tiến độ, cảnh báo ở 80% và 100%.
- **Mục tiêu tiết kiệm** (goal): tên, số tiền mục tiêu, hạn, nạp tiền vào mục tiêu, % hoàn thành; hỗ trợ cả mục tiêu **chung** của couple.
- **Báo cáo**: thu/chi theo tháng (biểu đồ cột 6–12 tháng), so sánh với tháng trước, xu hướng chi theo danh mục.

### 6.6 Dashboard tài chính cá nhân
Tổng số dư; thu và chi tháng này (kèm % so với tháng trước); biểu đồ tròn chi tiêu theo danh mục (top 5 + "Khác"); số dư từng ví; 5 giao dịch gần nhất; tiến độ ngân sách.

---

## 7. CẶP ĐÔI (COUPLE)

- Tạo couple: user A tạo → `status=active`, A là `owner`.
- Mời: A tạo **mã mời** (6–8 ký tự, ngẫu nhiên, hết hạn 48 giờ, dùng một lần) và link `/invite/:code`. Có thể thu hồi/tạo lại mã.
- Chấp nhận: B nhập mã/mở link → thêm B vào `couple_members` với role `member`. Dùng DB transaction.
- **Một user chỉ thuộc một couple active.** Kiểm tra khi tạo và khi chấp nhận. Không tự chấp nhận lời mời của chính mình.
- Rời couple: member rời → xóa khỏi nhóm; owner phải chuyển quyền hoặc giải tán nếu chỉ còn một mình. Khi rời/giải tán phải xử lý dữ liệu chung: **không xóa**, chuyển sang trạng thái "lưu trữ" (archived), vẫn xem được lịch sử dưới dạng chỉ đọc cho cả hai; cảnh báo nếu còn công nợ chưa thanh toán và yêu cầu xác nhận.
- Màn hình: thông tin hai thành viên, mã mời + nút sao chép, rời/giải tán, khối công nợ tóm tắt.
- Tính năng thêm: **ngày kỷ niệm** (ngày bắt đầu yêu nhau, đếm số ngày bên nhau, nhắc kỷ niệm trong dashboard), **bảng hoạt động chung** (activity feed: "Lan vừa thêm chi tiêu chung 400.000 đ").

---

## 8. TÀI CHÍNH CHUNG (SHARED FINANCE)

Chỉ khả dụng khi user thuộc couple active (middleware `requireCouple`).

### 8.1 Quỹ chung (Shared Wallet)
- Nhiều quỹ/couple (Quỹ sinh hoạt, Quỹ du lịch…). CRUD bởi thành viên couple.
- Tính năng thêm: **nạp quỹ** (contribution) — mỗi thành viên nạp tiền vào quỹ, ghi nhận người nạp; số dư quỹ = tổng nạp − tổng chi từ quỹ.

### 8.2 Giao dịch chung (Shared Transaction)
- Trường: quỹ, người trả (payer), số tiền (nguyên > 0), ngày, mô tả, danh mục, kiểu chia.
- **Nguồn tiền (`paidFrom`)**:
  - `fund`: trả từ quỹ chung → trừ số dư quỹ, **không phát sinh nợ**.
  - `personal`: payer tự ứng tiền → không trừ quỹ; chia tiền theo split và **phát sinh công nợ**.
- Kiểu chia:
  - `equal`: mỗi người = tổng / 2, làm tròn xuống, **phần dư thuộc về payer**.
  - `custom`: nhập số tiền từng người.
  - Tính năng thêm: `percent` (chia theo %).
- **Validation cứng**: tổng `shareAmount` phải bằng đúng `amount`, nếu không trả **400**. Mỗi `userId` trong split phải là thành viên couple.
- Sau khi tạo: ghi `shared_transaction_splits`; tạo/cập nhật công nợ trong cùng DB transaction.
- Xóa giao dịch chung: chỉ người tạo (hoặc owner) được xóa; nếu công nợ liên quan đã `paid` thì không cho xóa (hoặc tạo bút toán điều chỉnh) — ghi rõ quyết định trong `DECISIONS.md`.

### 8.3 Công nợ và hoàn tiền (Settlement)
- Chỉ **tự động sinh từ giao dịch chung**, không cho tạo settlement tự do.
- Tính **số dư ròng** giữa hai người: nếu A trả nhiều hơn phần của mình → B nợ A. Hiển thị gọn: "Lan nợ Minh 150.000 đ" hoặc "Đã cân bằng".
- Luồng thanh toán: người nợ chuyển tiền ngoài ứng dụng → bấm "Tôi đã trả" (`pending_confirm`) → **người nhận xác nhận** → `paid` + `paidAt`. Chỉ người nhận mới được xác nhận. Có thể từ chối, ghi chú.
- Danh sách chờ thanh toán + lịch sử đã thanh toán, lọc theo thời gian.

### 8.4 Dashboard chung
Số dư các quỹ; tổng chi chung tháng này (theo danh mục); ai nợ ai bao nhiêu; giao dịch chung gần nhất; tiến độ mục tiêu chung.

---

## 9. CÔNG VIỆC (TODO)

- Trường: tiêu đề, mô tả, hạn chót, ưu tiên (`LOW|MEDIUM|HIGH|URGENT`), trạng thái (`TODO|IN_PROGRESS|DONE|CANCELLED`), người thực hiện (`assignedTo`, có thể trống, phải là thành viên couple với task chung), `createdBy`, `coupleId` (null = cá nhân).
- CRUD, đánh dấu hoàn thành (ghi `completedAt`), kéo-thả hoặc chọn để đổi trạng thái.
- Quyền: task cá nhân chỉ chủ sở hữu thấy; task chung cả hai thấy và **cả hai đều sửa được**.
- Bộ lọc: cá nhân/chung/giao cho tôi, trạng thái, ưu tiên, hạn chót; tìm kiếm; sắp xếp.
- Hai chế độ xem: **danh sách** và **bảng Kanban** (4 cột theo trạng thái).
- Dashboard: task **hôm nay** (deadline = hôm nay) và task **quá hạn** (deadline < hôm nay & chưa xong).
- Tính năng thêm: **việc con (checklist)**, **công việc lặp lại** (hằng ngày/tuần/tháng — tự tạo bản kế tiếp khi hoàn thành), **bình luận ngắn** trên task chung, **danh sách mua sắm chung** (shopping list tick-chọn), nhãn (label).

---

## 10. TẬP LUYỆN (FITNESS) — hoàn toàn cá nhân

### 10.1 Bài tập (Exercise)
Seed sẵn: Bench Press, Incline Press, Squat, Deadlift, Pull Up, Shoulder Press, Barbell Row, Leg Press, Bicep Curl, Triceps Pushdown… kèm nhóm cơ (Ngực, Lưng, Chân, Vai, Tay, Bụng). User tự tạo thêm.

### 10.2 Buổi tập (Workout Session)
- Trường: ngày, **thời gian tập (phút)**, ghi chú, (tùy chọn) giờ bắt đầu/kết thúc, cảm giác buổi tập (1–5), cân nặng cơ thể.
- CRUD; chỉ chủ sở hữu truy cập.

### 10.3 Set (Workout Set)
- Trường: bài tập, số thứ tự set, **trọng lượng (kg)**, **số rep**, `done` (mặc định true), loại set (`warmup|working|dropset|failure`), RPE (tùy chọn).
- Giao diện ghi nhanh: sao chép set trước, tự điền trọng lượng/rep của buổi gần nhất, bộ đếm giờ nghỉ giữa set.

### 10.4 Phân tích và tiến độ (bắt buộc)
1. **Biểu đồ đường — Volume theo thời gian** (Σ weight × reps theo buổi, lọc 7/30/90 ngày, theo bài tập).
2. **Biểu đồ tròn (donut) — Mức độ tập theo rep**: chia set thành **Nặng (1–5 rep)**, **Vừa (6–12 rep)**, **Nhẹ (13+ rep)**; hiển thị số set và %. Cho lọc theo khoảng thời gian và theo bài tập.
3. Thẻ thống kê: số buổi tuần/tháng này, **TB rep/set**, **TB thời gian/buổi** và tổng thời gian, volume buổi gần nhất, tần suất tập.
4. **Tiến triển trọng lượng** của từng bài (đường theo buổi) và **ước tính 1RM** (công thức Epley: `w × (1 + reps/30)`).
5. **Kỷ lục cá nhân (PR)**: tự phát hiện và đánh dấu khi phá kỷ lục trọng lượng/volume/1RM.
6. So sánh **tuần này với tuần trước** (volume, số buổi, TB rep/set) — để thấy mức lũy tiến và độ chênh lệch.
7. Gợi ý "tiếp tục": hiển thị bài tập gần nhất kèm trọng lượng/rep lần trước.

### 10.5 Tính năng thêm
**Mẫu buổi tập (template)** (Push/Pull/Legs…), **theo dõi cân nặng/số đo cơ thể** theo thời gian (biểu đồ), mục tiêu tập luyện hằng tuần (vd: 4 buổi/tuần) kèm thanh tiến độ.

---

## 11. DASHBOARD TỔNG HỢP (TRANG CHỦ)

Lời chào + ngày. Các khu vực:
- **Tài chính**: tổng số dư cá nhân (+ quỹ chung nếu có couple), thu/chi tháng này, biểu đồ chi theo danh mục, ngân sách sắp vượt.
- **Todo**: task hôm nay + quá hạn (bấm để hoàn thành nhanh).
- **Fitness**: buổi tập gần nhất, số buổi tuần này, tổng volume tuần, mini biểu đồ volume.
- **Cặp đôi** (nếu có): thông tin thành viên, số ngày bên nhau, công nợ ròng, hoạt động gần đây.
- **Hành động nhanh**: + Giao dịch, + Chi tiêu chung, + Việc, + Buổi tập.
- Tính năng thêm: **thông báo trong ứng dụng** (chuông): lời mời couple, công nợ mới, yêu cầu xác nhận thanh toán, task được giao, task sắp đến hạn, vượt ngân sách. (Chỉ in-app, không email/SMS.)

---

## 12. CƠ SỞ DỮ LIỆU (MongoDB)

Tất cả `_id` là ObjectId; tiền là `Number` nguyên (VND). Thêm index như ghi chú.

| Collection | Trường chính | Index |
|---|---|---|
| `users` | email (unique), passwordHash, name, avatar, timezone, loginAttempts, lockUntil | email |
| `refresh_tokens` | userId, tokenHash, family, expiresAt, revokedAt | userId, tokenHash |
| `couples` | createdBy, status (`active/inactive`), anniversaryDate | — |
| `couple_members` | coupleId, userId, role (`owner/member`), joinedAt | userId (unique khi active) |
| `invitations` | coupleId, code (unique), inviterId, expiresAt, usedAt | code, expiresAt |
| `wallets` | userId, name, type, balance, currency, allowNegative, archived, color | userId |
| `categories` | userId (null = hệ thống), name, type, icon | userId |
| `transactions` | userId, walletId, categoryId, amount, type, date, description, tags, transferId, recurringId | userId+date, walletId |
| `recurring_rules` | userId, template, frequency, nextRunAt, active | nextRunAt |
| `budgets` | userId, categoryId, month, limit | userId+month |
| `goals` | userId/coupleId, name, target, saved, deadline | — |
| `shared_wallets` | coupleId, name, balance | coupleId |
| `shared_contributions` | sharedWalletId, userId, amount, date | sharedWalletId |
| `shared_transactions` | sharedWalletId, coupleId, payerId, amount, date, description, categoryId, splitType, paidFrom | coupleId+date |
| `shared_transaction_splits` | sharedTransactionId, userId, shareAmount | sharedTransactionId |
| `settlements` | coupleId, fromUserId, toUserId, amount, status (`pending/pending_confirm/paid`), sourceTransactionId, createdAt, paidAt | coupleId+status |
| `tasks` | title, description, deadline, priority, status, assignedTo, createdBy, coupleId, labels, subtasks, recurrence, completedAt | createdBy, coupleId+deadline |
| `task_comments` | taskId, userId, content | taskId |
| `exercises` | name, muscleGroup, isSystem, userId | userId |
| `workout_sessions` | userId, date, durationMinutes, notes, mood, bodyWeight | userId+date |
| `workout_sets` | sessionId, userId, exerciseId, setNumber, weight, reps, setType, rpe, done | sessionId, exerciseId |
| `workout_templates` | userId, name, items | userId |
| `body_metrics` | userId, date, weight, measurements | userId+date |
| `notifications` | userId, type, payload, readAt | userId+readAt |
| `activity_log` | coupleId, actorId, action, payload | coupleId+createdAt |

---

## 13. BUSINESS RULES (CỰC KỲ QUAN TRỌNG)

1. Giao dịch cá nhân: `amount > 0` và là số nguyên. Income tăng balance, expense giảm balance. **Luôn dùng MongoDB transaction** để cập nhật giao dịch + ví cùng lúc.
2. Giao dịch chung: Σ split = amount, không lệch dù 1 đồng. `equal` → mỗi người `floor(amount/2)`, phần dư thuộc payer.
3. Quyền truy cập: user chỉ thấy ví của mình; chỉ thành viên couple active thấy dữ liệu chung; task cá nhân chỉ chủ sở hữu thấy, task chung cả hai thấy và sửa; workout chỉ chủ sở hữu.
4. Settlement chỉ sinh từ giao dịch chung; chỉ người nhận được xác nhận `paid`.
5. Một user chỉ thuộc một couple active.
6. Không cho thao tác trên tài nguyên của người khác: trả **404** (không lộ sự tồn tại) hoặc **403** thống nhất.
7. Các rule này nằm ở tầng Service và có test.

---

## 14. API (tiền tố `/api`, JSON, có OpenAPI/Swagger tại `/api/docs`)

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `/auth/change-password` |
| User | `GET/PUT /users/me`, `DELETE /users/me` |
| Wallet | `GET/POST /wallets`, `GET/PUT/DELETE /wallets/:id`, `POST /wallets/transfer`, `POST /wallets/:id/reconcile` |
| Category | `GET/POST /categories`, `PUT/DELETE /categories/:id` |
| Transaction | `GET/POST /transactions`, `GET/PUT/DELETE /transactions/:id`, `GET /transactions/export` |
| Recurring | `GET/POST /recurring`, `PUT/DELETE /recurring/:id` |
| Budget/Goal | `GET/POST /budgets`, `PUT/DELETE /budgets/:id`, `GET/POST /goals`, `POST /goals/:id/contribute` |
| Report | `GET /reports/monthly`, `GET /reports/by-category` |
| Couple | `POST /couples`, `GET /couples/me`, `POST /couples/invite`, `POST /couples/accept`, `DELETE /couples/leave`, `POST /couples/transfer-owner` |
| Shared Wallet | `GET/POST /shared-wallets`, `PUT/DELETE /shared-wallets/:id`, `POST /shared-wallets/:id/contribute` |
| Shared Tx | `GET/POST /shared-transactions`, `GET/DELETE /shared-transactions/:id` |
| Settlement | `GET /settlements`, `GET /settlements/summary`, `PUT /settlements/:id/mark-paid`, `PUT /settlements/:id/confirm`, `PUT /settlements/:id/reject` |
| Task | `GET/POST /tasks`, `GET/PUT/DELETE /tasks/:id`, `PATCH /tasks/:id/status`, `GET/POST /tasks/:id/comments` |
| Exercise | `GET/POST /exercises`, `PUT/DELETE /exercises/:id` |
| Workout | `GET/POST /workout-sessions`, `GET/PUT/DELETE /workout-sessions/:id`, `POST /workout-sets`, `PUT/DELETE /workout-sets/:id`, `GET/POST /workout-templates` |
| Fitness stats | `GET /fitness/stats?range=30d`, `/fitness/volume`, `/fitness/rep-distribution`, `/fitness/progress/:exerciseId`, `/fitness/prs` |
| Body | `GET/POST /body-metrics` |
| Notification | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| Dashboard | `GET /dashboard` (một lần trả đủ dữ liệu tổng hợp) |
| Health | `GET /health` |

Mọi input được validate bằng Zod (body, query, params) trước khi vào service.

---

## 15. BẢO MẬT

bcrypt; JWT secret mạnh trong biến môi trường; access token ngắn + refresh rotation; HTTPS bắt buộc ở production; CORS chỉ cho domain frontend; `helmet`; rate limit; validate mọi input; chống NoSQL injection (ép kiểu, `express-mongo-sanitize`); không trả `passwordHash`/token trong response; log không chứa dữ liệu nhạy cảm; mọi secret ở `.env` (không commit); xử lý lỗi tập trung không lộ stack trace ở production; kiểm tra quyền ở service cho từng tài nguyên.

---

## 16. KIỂM THỬ

Bắt buộc có test (database test riêng, chạy trong CI):
- **Auth**: đăng ký thành công/trùng email; đăng nhập đúng/sai; token hợp lệ/hết hạn; refresh rotation; rate limit.
- **Tài chính cá nhân**: income tăng số dư; expense giảm số dư; chi vượt số dư bị chặn; sửa/xóa giao dịch cập nhật đúng số dư; transfer giữa ví; rollback khi lỗi giữa chừng; transaction đồng thời không làm lệch số dư.
- **Couple**: tạo/mời/chấp nhận; mã hết hạn/đã dùng; một user một couple; rời/giải tán.
- **Tài chính chung**: chia đều (kể cả số lẻ), chia tùy chỉnh đúng tổng, sai tổng → 400, tính công nợ ròng, xác nhận chỉ người nhận được làm.
- **Phân quyền**: A không lấy được ví của B; không xem được shared transaction của couple khác; chỉ thấy task của mình hoặc task chung; workout riêng tư.
- **Fitness**: volume, phân bố rep (ranh giới 5/6, 12/13), 1RM, PR, so sánh tuần.
- Frontend: test các form chính và component quan trọng.
- Mục tiêu coverage: logic nghiệp vụ (service) ≥ 80%.

---

## 17. KẾ HOẠCH THỰC HIỆN (LÀM TUẦN TỰ, DỪNG SAU MỖI GIAI ĐOẠN)

0. **Khởi tạo repo**: cấu trúc monorepo, lint/format, Docker Compose (api + web + mongo replica set), `.env.example`, CI, design system + layout (Sidebar/BottomNav), trang đăng nhập/đăng ký giả.
1. **Auth & User**: toàn bộ mục 5 + test.
2. **Tài chính cá nhân**: ví, danh mục, giao dịch, transfer, lọc/tìm, dashboard tài chính, + test (ưu tiên test số dư).
3. **Ngân sách, mục tiêu, giao dịch định kỳ, báo cáo, xuất CSV.**
4. **Couple**: mời/chấp nhận/rời, ngày kỷ niệm, activity feed.
5. **Tài chính chung**: quỹ, nạp quỹ, giao dịch chung, split, settlement + test nghiêm ngặt.
6. **Todo**: CRUD, quyền, Kanban, việc con, lặp lại, bình luận, shopping list.
7. **Fitness**: bài tập, buổi tập, set, thống kê, donut rep, volume, PR, 1RM, template, body metrics.
8. **Dashboard tổng hợp + thông báo in-app.**
9. **Hoàn thiện**: responsive/PWA, a11y, tối ưu hiệu năng, seed dữ liệu demo, Swagger đầy đủ.
10. **Kiểm thử toàn diện** (E2E luồng chính bằng Playwright nếu có thể).
11. **Triển khai production**: `docker-compose.prod.yml`, HTTPS (Let's Encrypt), biến môi trường, backup MongoDB định kỳ, hướng dẫn trong README.

---

## 18. TIÊU CHÍ HOÀN THÀNH (ACCEPTANCE CHECKLIST)

- [ ] Hai tài khoản thật đăng nhập đồng thời, ghép đôi bằng mã mời.
- [ ] Mọi chức năng ở mục 5–11 hoạt động, kể cả các "tính năng thêm".
- [ ] Số dư ví luôn khớp với tổng giao dịch (đối soát không lệch).
- [ ] Tổng split luôn bằng số tiền; công nợ ròng đúng.
- [ ] Biểu đồ tròn phân bố rep và biểu đồ volume hoạt động đúng.
- [ ] Giao diện đúng bảng màu trắng – xanh cốm – hồng, responsive, có loading/empty/error.
- [ ] Toàn bộ test xanh; CI xanh; không có secret trong git.
- [ ] `docker compose up` chạy được toàn bộ stack từ máy trống.
- [ ] Chạy trên domain thật với HTTPS.
- [ ] Có `README.md` (giới thiệu, cài đặt, chạy Docker, biến môi trường, link demo), `.env.example`, `.gitignore`, tài liệu API (Swagger), lịch sử commit sạch.

---

## 19. ĐẦU RA MỖI GIAI ĐOẠN

Sau mỗi giai đoạn, trả lời theo mẫu:
1. Đã làm gì (ngắn gọn).
2. Danh sách file mới/sửa.
3. Cách chạy và kiểm tra (lệnh cụ thể).
4. Kết quả test.
5. Các quyết định/giả định đã chọn (cũng ghi vào `docs/DECISIONS.md`).
6. Việc tiếp theo và câu hỏi (nếu có).

**Bắt đầu ngay với Giai đoạn 0.**
