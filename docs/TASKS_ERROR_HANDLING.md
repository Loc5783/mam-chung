# HỢP ĐỒNG XỬ LÝ LỖI & KHẢ NĂNG CHỊU LỖI MODULE CÔNG VIỆC (TO-DO)
**Dự án:** Mầm Chung (`@mam-chung/web` & `@mam-chung/api`)  
**Tài liệu:** Quality & Error Resilience Contract  
**Phiên bản:** 1.0 (Hoàn thành chuỗi Hardening A1-A4 & B1-B5)

---

## 1. Nguyên tắc cốt lõi
1. **Không có lỗi 500 do thao tác người dùng:** Mọi dữ liệu đầu vào không hợp lệ từ người dùng (ID sai cú pháp, ngày tháng lệch chuẩn, JSON rỗng, số âm, ký tự lạ...) đều được bắt ở tầng kiểm thực và trả về mã lỗi `4xx` với thông báo tiếng Việt dễ hiểu.
2. **Không nuốt lỗi (No Silent Swallow):** Mọi nhánh `catch` đều được phân loại, hiển thị thông báo ấm áp cho người dùng, ghi log kỹ thuật ra console/logger mà không làm lộ stack trace nội bộ ra UI.
3. **Bảo toàn dữ liệu đã nhập (Draft Preservation):** Khi có lỗi mạng, lỗi máy chủ (500) hoặc xung đột phiên bản (409 OCC), toàn bộ dữ liệu người dùng đang nhập trong form hoặc drawer phải được giữ nguyên 100%, không tự đóng form, không để UI kẹt ở trạng thái "đang lưu".
4. **Cô lập lỗi theo từng khu vực (Error Boundary Isolation):** Lỗi crash giao diện ở một thành phần (Lịch, Focus, Thống kê, Kanban) được chặn lại bởi `ViewErrorBoundary`, hiển thị thẻ thông báo lỗi và nút "Thử lại", không làm trắng toàn bộ trang web (White Screen of Death).
5. **Chống thao tác trùng lặp (Double-Submission Prevention):** Tất cả các nút bấm lưu/xóa/hoàn thành đều tự động vô hiệu hóa (`disabled`) khi mutation đang thực thi (`isPending` / `busy`) hoặc khi mất mạng (`!online`).

---

## 2. Bảng ánh xạ mã lỗi & Test chứng minh

### 2.1. Tầng Giao diện (Frontend - `apps/web`)

| Mã / Loại lỗi | Thông báo người dùng nhìn thấy | Tệp tin xử lý | Cơ chế bảo vệ | Test chứng minh |
| :--- | :--- | :--- | :--- | :--- |
| **Mất kết nối mạng (`!navigator.onLine`)** | *"Mất kết nối. Bạn vẫn có thể xem; kết nối mạng để lưu thay đổi."* / *"Mất kết nối. Kết nối mạng trước khi cập nhật công việc."* | `useOnline.ts`, `api.ts`, `TasksPage.tsx` | Chặn gửi mutation, hiển thị dải thông báo offline, vô hiệu hóa các nút ghi. | `apps/web/src/test/error-handling.test.tsx` |
| **Lỗi mạng đột ngột (Axios Network Error)** | *"Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền."* | `apiClient.ts` (`parseApiError`) | Chuyển đổi mã lỗi mạng không có response thành thông điệp tiếng Việt. | `apps/web/src/test/apiClient.test.ts` |
| **Xung đột phiên bản (`409 Conflict` - OCC Revision)** | *"Công việc đã được người khác cập nhật."* / *"Công việc đã được cập nhật ở nơi khác. Dữ liệu đã được làm mới."* | `TaskForm.tsx`, `TaskDetailDrawer.tsx`, `useTaskWrite.ts` | **Giữ nguyên 100% nội dung đang nhập**, không đóng modal, rollback cache lạc quan về trạng thái đúng từ máy chủ. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 3.1 & 3.2), `tasks.test.tsx` |
| **Dữ liệu không tồn tại (`404 Not Found`)** | *"Dữ liệu không tồn tại hoặc đã bị xóa."* | `useTaskWrite.ts` (`apiClient.ts`) | Hiển thị thông báo ấm áp, **tự động xóa bản ghi lỗi khỏi TanStack Query cache** để tránh UI kẹt dữ liệu rác. | `apps/web/src/test/user-errors-b2.test.tsx` |
| **Dán văn bản nhiều dòng quá mức (>50 việc)** | *"Bạn đang dán X dòng. Để đảm bảo hiệu năng, hệ thống chỉ hỗ trợ tạo tối đa 50 việc cùng lúc."* | `QuickAddBar.tsx` | Cảnh báo rõ ràng, cung cấp nút *"Chỉ giữ 50 việc đầu tiên"* để người dùng bấm cắt an toàn. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 1.1) |
| **Ký tự Unicode tổ hợp sai chuẩn** | Chuẩn hóa ngầm về chuẩn Unicode NFC | `QuickAddBar.tsx`, `TaskDetailDrawer.tsx` | Tự động chạy `.normalize("NFC")` cho tiêu đề và nội dung mô tả tiếng Việt có dấu. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 1.2) |
| **Nhập nhãn có dấu `#` (`#nhà, #chợ`)** | Tự động gỡ dấu `#` thành `nhà, chợ` | `TaskForm.tsx`, `TaskDetailDrawer.tsx`, `BulkActionBar.tsx` | Regex làm sạch `replace(/^#+/, "")`, loại bỏ trùng lặp bằng `Set`. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 2.1 & 4.1) |
| **Nhập quá 10 nhãn / Nhãn >30 ký tự** | *"Tối đa 10 nhãn."* / *"Mỗi nhãn tối đa 30 ký tự."* | `TaskForm.tsx` (Zod schema) | Chặn submit tại client, báo lỗi đỏ ngay dưới ô nhập nhãn. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 2.2) |
| **Hạn chót nằm trong quá khứ** | *"Lưu ý: Hạn chót đã qua so với hôm nay."* | `TaskForm.tsx`, `TaskDetailDrawer.tsx` | Cảnh báo màu hổ phách (`#b45309`) nhắc nhở, không cấm hẳn để cho phép nhập việc bổ sung. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 2.4 & 3.2) |
| **Gõ Enter trong ô thêm việc con (Checklist)** | Thêm mục vào checklist | `TaskForm.tsx` | Bắt sự kiện `onKeyDown` (Enter), gọi `e.preventDefault()` để không submit form chính ngoài ý muốn. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 2.3) |
| **Lỗi máy chủ nội bộ (`500 Internal Server Error`)** | *"Máy chủ đang bận. Dữ liệu của bạn vẫn được giữ nguyên, vui lòng thử lại."* | `TaskForm.tsx`, `apiClient.ts` | Giữ nguyên dữ liệu trên form, không xóa trường nhập, thông báo rõ ràng. | `apps/web/src/test/user-errors-b2.test.tsx` (Test 2.5) |
| **Lỗi trình duyệt/Private Mode (`localStorage` đầy hoặc bị chặn)** | Ghi log cảnh báo `console.warn`, fallback in-memory | `apps/web/src/lib/storage.ts` (`safeStorage`) | Bọc an toàn `getItem`, `setItem`, `removeItem`, chống văng ngoại lệ `QuotaExceededError` / `SecurityError`. | `apps/web/src/test/error-handling.test.tsx` |
| **Crash View Component (Lịch, Thống kê, Focus, Kanban)** | *"Không thể tải [Tên View]. Vui lòng bấm thử lại."* | `components/ui/ViewErrorBoundary.tsx` | React Error Boundary cô lập crash, giữ nguyên thanh điều hướng và phần còn lại của ứng dụng. | `apps/web/src/test/error-handling.test.tsx` |

---

### 2.2. Tầng Máy chủ (Backend - `apps/api`)

| Trường hợp thao tác | Mã HTTP | Thông báo / Phản hồi JSON | Tệp tin xử lý | Test chứng minh |
| :--- | :---: | :--- | :--- | :--- |
| **ID công việc / danh sách sai cú pháp** (không phải ObjectId 24 hex) | `400 Bad Request` | `{ "error": { "message": "Mã định danh công việc không hợp lệ." } }` | `tasks/routes.ts`, `errorMiddleware.ts` | `src/modules/tasks/tests/error-resilience.test.ts` |
| **Cập nhật sai phiên bản (OCC Conflict)** | `409 Conflict` | `{ "error": { "message": "Công việc đã được người khác cập nhật." } }` | `tasks/service.ts` | `src/modules/tasks/tests/tasks.test.ts` |
| **Công việc không tồn tại khi sửa/xóa/đổi trạng thái** | `404 Not Found` | `{ "error": { "message": "Không tìm thấy công việc." } }` | `tasks/service.ts` | `src/modules/tasks/tests/tasks.test.ts` |
| **Việc lặp lại nhưng không có hạn chót** | `400 Bad Request` | `{ "error": { "message": "Việc lặp lại cần hạn chót." } }` | `tasks/validation.ts` | `src/modules/tasks/tests/foundation.test.ts` |
| **Tiêu đề trống hoặc dài hơn 160 ký tự** | `400 Bad Request` | `{ "error": { "message": "Nhập tiêu đề công việc." } }` | `tasks/validation.ts` | `src/modules/tasks/tests/foundation.test.ts` |
| **Thao tác danh sách người khác (Không thuộc cặp đôi)** | `403 Forbidden` | `{ "error": { "message": "Bạn không có quyền thao tác trên danh sách này." } }` | `tasks/service.ts` | `src/modules/tasks/tests/foundation.test.ts` |
| **Tính chuỗi thống kê (Stats Streak) khi ngày không liên tục** | `200 OK` | Tính toán an toàn, trả về số ngày liên tiếp chính xác, không tràn mốc | `tasks/service.ts` | `src/modules/tasks/tests/stats.test.ts` |
| **Cửa sổ thói quen trễ hạn (lateHabits)** | `200 OK` | Lấy đúng cửa sổ thời gian (7d/30d/90d), không lỗi chia cho 0 | `tasks/service.ts` | `src/modules/tasks/tests/stats.test.ts` |

---

## 3. Kịch bản kiểm thử thủ công (Manual Test Checklist - 10 Ca oái oăm)

Chủ dự án hoặc người kiểm thử có thể thực hiện 10 bước sau trên trình duyệt thật để tự tay nghiệm thu khả năng chịu lỗi của hệ thống:

```markdown
[ ] 1. ĐANG SỬA THÌ MẤT MẠNG:
       - Mở một việc để sửa trong form hoặc drawer.
       - Tắt Wi-Fi / bật Airplane mode trên máy tính.
       - Bấm nút "Lưu".
       - KẾT QUẢ ĐÚNG: Nút bấm disabled hoặc hiện thông báo "Mất kết nối", toàn bộ nội dung vừa gõ vẫn NGUYÊN VẸN trong form, không bị đóng hay mất chữ.

[ ] 2. XUNG ĐỘT SỬA ĐỒI GIỮA HAI NGƯỜI (409 CONFLICT):
       - Mở 2 tab trình duyệt cùng xem việc chung A (Tab 1 và Tab 2).
       - Ở Tab 1: Sửa tiêu đề thành "A1" và Lưu thành công.
       - Ở Tab 2 (vẫn đang mở bản cũ): Sửa tiêu đề thành "A2" và Lưu.
       - KẾT QUẢ ĐÚNG: Tab 2 báo thông báo ấm áp "Công việc đã được người khác cập nhật", form giữ nguyên nội dung "A2" để người dùng không mất công gõ, cho phép sao chép hoặc tải lại.

[ ] 3. MỘT NGƯỜI ĐÃ XÓA, NGƯỜI KIA BẤM HOÀN THÀNH (404 NOT FOUND):
       - Mở 2 tab trình duyệt cùng xem danh sách việc.
       - Ở Tab 1: Xóa vĩnh viễn việc B.
       - Ở Tab 2: Bấm tick hoàn thành việc B.
       - KẾT QUẢ ĐÚNG: Tab 2 báo "Dữ liệu không tồn tại hoặc đã bị xóa", hàng việc B tự động biến mất khỏi danh sách ở Tab 2, không gây crash ứng dụng.

[ ] 4. DÁN 100 DÒNG TỪ WORD / EXCEL / NOTEPAD:
       - Copy 100 dòng văn bản bất kỳ.
       - Dán vào ô "Thêm nhanh" (`QuickAddBar`).
       - KẾT QUẢ ĐÚNG: Hiện cảnh báo "Bạn đang dán 100 dòng... chỉ hỗ trợ tối đa 50 việc cùng lúc", có nút "Chỉ giữ 50 việc đầu tiên". Bấm nút thì tự động cắt đúng 50 dòng an toàn.

[ ] 5. NHẬP NHÃN KÈM DẤU THĂNG (#NHÀ, #CHỢ, #NHÀ):
       - Mở form tạo việc, nhập vào ô Nhãn: `#siêu_thị, #chợ, #siêu_thị, ##nhà`.
       - Bấm Lưu.
       - KẾT QUẢ ĐÚNG: Hệ thống tự động bóc tách thành 3 nhãn sạch sẽ: `siêu_thị`, `chợ`, `nhà` (loại bỏ `#` và lọc trùng lặp).

[ ] 6. GÕ ENTER KHI ĐANG NHẬP VIỆC CON (CHECKLIST):
       - Mở form tạo việc mới, gõ tiêu đề "Đi chợ".
       - Chuyển xuống ô "Nội dung việc con", gõ "Mua rau", rồi ấn phím Enter.
       - KẾT QUẢ ĐÚNG: Mục "Mua rau" được thêm ngay vào danh sách việc con bên dưới, con trỏ sẵn sàng nhập tiếp, FORM CHÍNH KHÔNG BỊ SUBMIT BẤT NGỜ.

[ ] 7. CHỌN HẠN CHÓT QUÁ KHỨ (NGÀY HÔM QUA):
       - Mở form tạo việc hoặc drawer chi tiết, chọn hạn chót lùi về 3 ngày trước.
       - KẾT QUẢ ĐÚNG: Dưới ô ngày hiển thị dòng nhắc màu hổ phách: "Lưu ý: Hạn chót đã qua so với hôm nay", nhưng vẫn cho phép lưu để phục vụ ghi chép việc đã làm.

[ ] 8. BẤM NHẤP ĐÚP CHUỘT LIÊN TỤC VÀO NÚT "LƯU" / "HOÀN THÀNH":
       - Bấm 5 lần thật nhanh vào nút "Lưu" hoặc tick hoàn thành.
       - KẾT QUẢ ĐÚNG: Nút chuyển ngay sang trạng thái busy/disabled sau cú bấm đầu tiên, Network tab chỉ gửi duy nhất 1 request API, không sinh ra việc trùng lặp.

[ ] 9. THỬ GÕ KÝ TỰ ĐẶC BIỆT VÀ TIẾNG VIỆT TỔ HỢP TRÊN ĐIỆN THOẠI:
       - Gõ tiêu đề tiếng Việt có dấu với bộ gõ Telex / VNI phức tạp: "Đã kiểm tra kỹ lưỡng ổi & xoài 🌱".
       - KẾT QUẢ ĐÚNG: Hiển thị tròn vành rõ chữ, không bị lỗi font tổ hợp, không bị rớt dấu khi lưu lên MongoDB và đọc lại.

[ ] 10. CHUYỂN BỘ LỌC KHIẾN DANH SÁCH RỖNG:
       - Đang xem danh sách, lọc "Giao cho tôi" + Trạng thái "Đã hủy" (không có việc nào thỏa mãn).
       - KẾT QUẢ ĐÚNG: Huy hiệu bộ lọc hiện "Bộ lọc · 2", màn hình hiện Empty State lịch sự: "Chưa có công việc phù hợp — Thêm việc mới hoặc thay đổi bộ lọc", có nút "Đặt lại bộ lọc" để 1-click đưa danh sách trở lại bình thường.
```

---

## 4. Báo cáo kích thước gói đóng gói (Bundle Size)

Tối ưu hóa phân rã mã nguồn (Code-Splitting) sau khi hoàn thành Phase B4:

| Chunk đóng gói | Kích thước Raw | Kích thước Gzip | Ghi chú tải trang |
| :--- | :---: | :---: | :--- |
| `TasksPage-OHw90w44.js` | **139.53 kB** | **44.93 kB** | Chunk chính của trang To-do sau khi phân rã |
| `CalendarView-JB8b7rti.js` | **3.31 kB** | **1.68 kB** | Lazy-load chỉ khi người dùng bấm tab Lịch |
| `FocusMode-DMn-_Ukr.js` | **5.32 kB** | **2.21 kB** | Lazy-load chỉ khi vào chế độ Tập trung |
| `StatsPanel-CfO4JGZy.js` | **12.19 kB** | **3.70 kB** | Lazy-load khi mở tab Thống kê |
| `ShoppingView-Cdso48od.js` | **0.86 kB** | **0.63 kB** | Lazy-load khi xem danh sách mua sắm |

**Kết luận:** Trang To-do khởi động nhẹ nhàng, không phình to bất thường, các tính năng nặng được nạp động theo nhu cầu thực tế (progressive disclosure).
