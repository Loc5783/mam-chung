# To-do List — Giai đoạn E: Nghiệm thu tính năng mở rộng & Nâng cấp tương tác

Ngày 2026-10-10. Hoàn thành và nghiệm thu đầy đủ Giai đoạn E theo kế hoạch A–F.

## 1. Đã làm

### Nghiệm thu các thành phần giao diện và backend mở rộng:

- **KanbanView**:
  - Phân chia 4 cột trạng thái chuẩn: Cần làm (`TODO`), Đang làm (`IN_PROGRESS`), Hoàn thành (`DONE`), Đã hủy (`CANCELLED`).
  - Hỗ trợ đổi trạng thái bằng kéo thả `@dnd-kit` và phương án bàn phím / thẻ chọn trực tiếp.
  - Khi API cập nhật thất bại: rollback dữ liệu trong cache về trạng thái ban đầu và hiển thị thông báo lỗi qua toast.
- **CalendarView**:
  - Chuyển đổi giữa chế độ xem Tuần (`week`) và Tháng (`month`).
  - Điều hướng ngày Trước / Sau / Hôm nay tính toán chuẩn xác theo múi giờ tài khoản người dùng (`user.timezone`).
  - Kéo thả việc sang ngày khác để dời hạn chót.
  - Bấm vào nút ngày trống để kích hoạt thêm công việc nhanh đúng hạn của ngày đó.
- **FocusMode (Pomodoro tập trung)**:
  - Đồng hồ đếm ngược với fake timer hỗ trợ tạm dừng, tiếp tục và đếm lùi thời gian.
  - Thời gian tập trung, nghỉ ngắn, nghỉ dài tùy chỉnh được (mặc định 25 / 5 / 15 phút, giới hạn work: 1–180 phút, rest: 1–60 phút).
  - Cho phép chọn chuyển đổi linh hoạt giữa Nghỉ ngắn và Nghỉ dài trong phiên nghỉ.
  - Bấm "Dừng và lưu thời gian" gọi `POST /tasks/:id/time` với chính xác số giây đã tập trung; nút bị vô hiệu hóa và không gửi API khi số giây bằng 0 (dưới 1 giây).
  - Dọn dẹp bộ đếm `setInterval` khi unmount để chống rò rỉ bộ nhớ.
  - Hiển thị thông báo rõ ràng: "Chỉ chạy khi tab đang mở." ở cả màn hình cấu hình và màn hình đồng hồ.
- **TemplatePicker**:
  - Mở hộp thoại chọn mẫu danh sách.
  - Lưu danh sách hiện tại thành mẫu dùng lại qua `POST /task-templates`.
  - Áp dụng mẫu qua `POST /task-templates/:id/apply`: tự động tạo danh sách mới, sao chép các việc độc lập, đặt lại trạng thái việc con (checklist) chưa hoàn thành, tính toán lại ngày bắt đầu.
- **ShoppingView**:
  - Tự động gom nhóm việc mua sắm theo nhãn đầu tiên (ví dụ `#rau`, `#thịt`, `#gia-vị`).
  - Các việc không có nhãn được đưa vào nhóm "Chưa phân khu".
  - Các nhóm trạng thái kết thúc ("Đã xong", "Đã hủy") được gom và đưa xuống cuối danh sách.
- **TaskExtras**:
  - Nút "Nhắc nhẹ 💌" chỉ hiển thị cho việc chung được giao cho người ấy, áp dụng giới hạn 1 lần/giờ/việc (trả lỗi 429 `NUDGE_LIMIT` nếu gửi lại trong vòng 1 giờ).
  - Nhân bản việc (`POST /tasks/:id/duplicate`) giữ nguyên nội dung, nhãn, checklist nhưng reset trạng thái về `TODO`.
  - Chuyển đổi không gian cá nhân ↔ chung có hộp thoại xác nhận. Nghiệp vụ backend bảo đảm chỉ người tạo (`createdBy`) mới có quyền chuyển việc chung thành việc cá nhân.

### Cải tiến và bổ sung theo E4:

- **Dán nhiều dòng trong QuickAddBar**:
  - Giới hạn dán tối đa 50 việc/lần (thay vì 100).
  - Khi vượt quá 50 dòng: hiển thị cảnh báo `Tối đa 50 việc mỗi lần.` và khóa nút Thêm.
  - Đổi tiêu đề hộp thoại xác nhận thành `Tạo N việc?`.
  - Xử lý mượt mà các ca biên: bỏ qua dòng trống, dòng chỉ có khoảng trắng, phân tích chính xác các thẻ `#nhãn`, `@người`, `!ưu-tiên` cho từng dòng độc lập.
- **Mô tả có định dạng nhẹ (FormattedDescription)**:
  - Tạo component độc lập `FormattedDescription.tsx`, không dùng thư viện ngoài nặng.
  - Tuyệt đối không dùng `dangerouslySetInnerHTML`. Mọi nội dung text đều được React tự động escape, ngăn chặn triệt để lỗ hổng XSS (`<script>`, `<img onerror>`).
  - Hỗ trợ định dạng an toàn: chữ đậm (`**văn bản**`), chữ nghiêng (`*văn bản*`), gạch đầu dòng (`- ` hoặc `* `) gom vào thẻ `<ul><li>`.
  - Chỉ cho phép liên kết an toàn có giao thức `http://` hoặc `https://`, gắn sẵn `target="_blank"` và `rel="noopener noreferrer"`.
  - Vô hiệu hóa và hiển thị dưới dạng văn bản thô đối với các liên kết nguy hiểm (`javascript:`, `data:`, `file:`, ...).
  - Tích hợp khung xem trước mô tả ("Xem trước mô tả:") vào cả `TaskDetailDrawer` và `TaskForm`.

## 2. File mới

- `apps/web/src/features/tasks/components/FormattedDescription.tsx`: Bộ hiển thị định dạng nhẹ an toàn (bold, italic, list, safe links, chống XSS).
- `apps/web/src/test/tasks-extras.test.tsx`: Bộ test frontend Vitest + React Testing Library gồm 21 bài test bao phủ toàn bộ thành phần giai đoạn E.
- `docs/TASKS_PHASE_E.md`: Tài liệu nghiệm thu giai đoạn E.

## 3. File sửa

- `apps/web/src/features/tasks/components/QuickAddBar.tsx`: Giới hạn 50 việc, alert "Tối đa 50 việc mỗi lần.", tiêu đề modal "Tạo N việc?".
- `apps/web/src/features/tasks/components/FocusMode.tsx`: Thêm cấu hình thời gian làm (25), nghỉ ngắn (5), nghỉ dài (15), nút chuyển loại nghỉ, thông báo tab đang mở.
- `apps/web/src/features/tasks/store/focus.ts`: Mở rộng type `FocusSession` với `longRestMinutes` và `restType`.
- `apps/web/src/features/tasks/components/TaskDetailDrawer.tsx`: Nhúng `FormattedDescription` xem trước mô tả.
- `apps/web/src/features/tasks/TaskForm.tsx`: Nhúng `FormattedDescription` xem trước mô tả khi nhập form.
- `apps/web/src/styles/global.css`: Định kiểu cho preview mô tả, markdown format và notice thông báo tab.
- `apps/api/src/modules/tasks/tests/extras.test.ts`: Bổ sung 7 test backend chuyên sâu:
  1. Giới hạn nhắc nhẹ 1 giờ/lần/việc và không ảnh hưởng giữa các việc khác nhau.
  2. Rerun job nhắc nhở (`runTaskReminderJob`) không sinh thông báo trùng lặp.
  3. Áp dụng mẫu danh sách tính đúng ngày và tạo đủ việc.
  4. Cộng dồn đồng thời `timeSpentSeconds` cho các session khác nhau.
  5. Audit log dòng hoạt động ghi đúng `actorId`, `actorName` và nội dung hành động.
  6. Phân quyền chuyển chung→cá nhân chỉ cho phép người tạo việc.
  7. Từ chối mọi thao tác ghi trên công việc của couple đã lưu trữ (`archived`).

## 4. Kiểm chứng

### Lệnh chạy kiểm thử

```powershell
# Chạy bộ test frontend
npm test -w @mam-chung/web

# Chạy riêng bộ test Phase E mới
npx vitest run src/test/tasks-extras.test.tsx

# Chạy bộ test backend extras
npm test -w @mam-chung/api -- --coverage=false src/modules/tasks/tests/extras.test.ts
```

### Kết quả kiểm chứng tự động:

- **Web**: 22 file test, **289/289 passed** (tăng thêm 21 test so với baseline 268 test).
- **Backend extras**: **22/22 passed** (gồm 15 test ban đầu + 7 test mới cho E3).
- **Lint & build**: Mã nguồn tuân thủ đầy đủ TypeScript và ESLint, không có lỗi biên dịch.

## 5. Kiểm tra bằng tay (E5)

| Hạng mục kiểm tra                      | Phương thức                        | Kết quả       | Ghi chú                                                         |
| -------------------------------------- | ---------------------------------- | ------------- | --------------------------------------------------------------- |
| Dán nhiều dòng ô thêm nhanh            | RTL Test (`tasks-extras.test.tsx`) | Đạt           | Bỏ qua dòng trống, mở modal "Tạo 3 việc?", chặn >50 dòng        |
| Mô tả định dạng nhẹ & chống XSS        | RTL Test (`tasks-extras.test.tsx`) | Đạt           | Render đậm/nghiêng/list/link an toàn; chặn script & javascript: |
| Kéo thả & phím tắt KanbanView          | RTL Test (`tasks-extras.test.tsx`) | Đạt           | Đổi cột trạng thái, có drag handle bàn phím, rollback + toast   |
| Điều hướng Lịch & chọn ngày            | RTL Test (`tasks-extras.test.tsx`) | Đạt           | Chuyển tuần/tháng, Trước/Sau, click ô ngày gọi onAdd            |
| Focus Pomodoro đếm giờ & lưu thời gian | RTL Test (`tasks-extras.test.tsx`) | Đạt           | Đếm ngược, tạm dừng/tiếp tục, lưu đúng số giây, dọn timer       |
| Mẫu danh sách (TemplatePicker)         | RTL Test (`tasks-extras.test.tsx`) | Đạt           | Lưu mẫu danh sách, áp dụng mẫu tạo danh sách mới                |
| Danh sách mua sắm (ShoppingView)       | RTL Test (`tasks-extras.test.tsx`) | Đạt           | Gom theo nhãn đầu tiên, Chưa phân khu, Đã xong xuống cuối       |
| Nhắc nhẹ & phân quyền chuyển scope     | Backend Test (`extras.test.ts`)    | Đạt           | Cooldown 1h, creator-only chuyển scope, couple lưu trữ chặn ghi |
| Hiển thị giao diện trên viewport 375px | Trình duyệt thật                   | **Chưa kiểm** | Môi trường dòng lệnh không có Playwright/trình duyệt thật       |
| Luồng hai tài khoản đồng thời          | Trình duyệt thật                   | **Chưa kiểm** | Đã kiểm chứng phân quyền mức Service API; chưa chạy 2 browser   |
| Kiểm tra `prefers-reduced-motion`      | Thiết bị thật                      | **Chưa kiểm** | Logic code đã dùng token motion tôn trọng reduced-motion        |

## 6. Giới hạn & Điểm sẵn sàng cho Giai đoạn F

- Các thành phần Phase E đã được kiểm chứng hoạt động tốt, giữ nguyên tính tương thích ngược với API và schema hiện có.
- File `TasksPage.tsx` hiện dài 1.374 dòng; chunk `TasksPage` cần được tách nhỏ và áp dụng dynamic lazy-loading cho các view lớn (`KanbanView`, `CalendarView`, `FocusMode`) trong Giai đoạn F3.
- Chưa có tính năng Thống kê công việc (`GET /api/tasks/stats` và `StatsPanel`) -> Sẽ thực hiện trong Giai đoạn F1 & F2.
