# HỢP ĐỒNG XỬ LÝ LỖI & KHẢ NĂNG CHỊU LỖI MODULE CÔNG VIỆC (TO-DO)

**Dự án:** Mầm Chung (`@mam-chung/web` & `@mam-chung/api`)  
**Tài liệu:** Quality & Error Resilience Contract  
**Phiên bản:** 1.1 (Cập nhật xử lý xung đột 409 hai lựa chọn, chuẩn hóa đường dẫn và kịch bản nghiệm thu thực tế)

---

## 1. Nguyên tắc cốt lõi

1. **Không có lỗi 500 do thao tác người dùng:** Mọi dữ liệu đầu vào không hợp lệ từ người dùng (ID sai cú pháp, ngày tháng lệch chuẩn, JSON rỗng, số âm, ký tự lạ...) đều được bắt ở tầng kiểm thực và trả về mã lỗi `4xx` với thông báo tiếng Việt dễ hiểu.
2. **Không nuốt lỗi (No Silent Swallow):** Mọi nhánh `catch` đều được phân loại, hiển thị thông báo ấm áp cho người dùng qua Toast/UI banner, ghi log kỹ thuật ra console/logger mà không làm lộ stack trace nội bộ ra UI.
3. **Bảo toàn dữ liệu đã nhập (Draft Preservation):** Khi có lỗi mạng, lỗi máy chủ (500) hoặc xung đột phiên bản (409 OCC), toàn bộ dữ liệu người dùng đang nhập trong form hoặc drawer phải được giữ nguyên 100%, không tự đóng form, không để UI kẹt ở trạng thái "đang lưu".
4. **Cô lập lỗi theo từng khu vực (Error Boundary Isolation):** Lỗi crash giao diện ở một thành phần (Lịch, Focus, Thống kê, Kanban) được chặn lại bởi `ViewErrorBoundary`, hiển thị thẻ thông báo lỗi và nút "Thử lại", không làm trắng toàn bộ trang web (White Screen of Death).
5. **Chống thao tác trùng lặp (Double-Submission Prevention):** Tất cả các nút bấm lưu/xóa/hoàn thành đều tự động vô hiệu hóa (`disabled`) khi mutation đang thực thi (`isPending` / `busy`) hoặc khi mất mạng (`!online`).

---

## 2. Bảng ánh xạ mã lỗi & Test chứng minh

### 2.1. Tầng Giao diện (Frontend - `apps/web`)

| Mã / Loại lỗi                                                      | Thông báo người dùng nhìn thấy                                                                                                   | Tệp tin xử lý                                                                                    | Cơ chế bảo vệ                                                                                                                                                                                                                                  | Test chứng minh (Số test thực tế)                                                                                                |
| :----------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| **Mất kết nối mạng (`!navigator.onLine`)**                         | _"Mất kết nối. Bạn vẫn có thể xem; kết nối mạng để lưu thay đổi."_ / _"Mất kết nối. Kết nối mạng trước khi cập nhật công việc."_ | `apps/web/src/features/tasks/lib/useOnline.ts`, `api.ts`, `TasksPage.tsx`                        | Chặn gửi mutation, hiển thị dải thông báo offline, vô hiệu hóa các nút ghi.                                                                                                                                                                    | `apps/web/src/test/error-handling.test.tsx` (15 tests)                                                                           |
| **Lỗi mạng đột ngột (Axios Network Error)**                        | _"Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền."_                                                               | `apps/web/src/lib/apiClient.ts` (`parseApiError`)                                                | Chuyển đổi mã lỗi mạng không có response thành thông điệp tiếng Việt.                                                                                                                                                                          | `apps/web/src/test/apiClient.test.ts` (13 tests)                                                                                 |
| **Xung đột phiên bản (`409 Conflict` - OCC Revision)**             | _"Công việc đã được người khác cập nhật. Nội dung đang nhập được giữ."_ kèm 2 nút: _"Xem bản mới"_ và _"Giữ bản của tôi"_        | `apps/web/src/features/tasks/components/TaskDetailDrawer.tsx`, `TaskForm.tsx`, `useTaskWrite.ts` | **Giữ nguyên 100% nội dung đang nhập**, hiển thị banner xung đột ấm áp kèm 2 lựa chọn: (1) _"Xem bản mới"_ tải lại dữ liệu mới nhất từ server và hủy bản nháp; (2) _"Giữ bản của tôi"_ lấy revision mới nhất từ server và ghi đè bản nháp lên. | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 3.1, 3.2 & 3.3), `apps/web/src/test/tasks-core.test.tsx` (23 tests) |
| **Dữ liệu không tồn tại (`404 Not Found`)**                        | _"Dữ liệu không tồn tại hoặc đã bị xóa."_                                                                                        | `apps/web/src/features/tasks/useTaskWrite.ts` (`apiClient.ts`)                                   | Hiển thị thông báo ấm áp, **tự động xóa bản ghi lỗi khỏi TanStack Query cache** để tránh UI kẹt dữ liệu rác.                                                                                                                                   | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests)                                                                           |
| **Dán văn bản nhiều dòng quá mức (>50 việc)**                      | _"Bạn đang dán X dòng. Để đảm bảo hiệu năng, hệ thống chỉ hỗ trợ tạo tối đa 50 việc cùng lúc."_                                  | `apps/web/src/features/tasks/components/QuickAddBar.tsx`                                         | Cảnh báo rõ ràng, cung cấp nút _"Chỉ giữ 50 việc đầu tiên"_ để người dùng bấm cắt an toàn.                                                                                                                                                     | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 1.1)                                                                |
| **Ký tự Unicode tổ hợp sai chuẩn**                                 | Chuẩn hóa ngầm về chuẩn Unicode NFC                                                                                              | `apps/web/src/features/tasks/components/QuickAddBar.tsx`, `TaskDetailDrawer.tsx`                 | Tự động chạy `.normalize("NFC")` cho tiêu đề và nội dung mô tả tiếng Việt có dấu.                                                                                                                                                              | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 1.2)                                                                |
| **Nhập nhãn có dấu `#` (`#nhà, #chợ`)**                            | Tự động gỡ dấu `#` thành `nhà, chợ`                                                                                              | `apps/web/src/features/tasks/TaskForm.tsx`, `TaskDetailDrawer.tsx`, `BulkActionBar.tsx`          | Regex làm sạch `replace(/^#+/, "")`, loại bỏ trùng lặp bằng `Set`.                                                                                                                                                                             | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 2.1 & 4.1)                                                          |
| **Nhập quá 10 nhãn / Nhãn >30 ký tự**                              | _"Tối đa 10 nhãn."_ / _"Mỗi nhãn tối đa 30 ký tự."_                                                                              | `apps/web/src/features/tasks/TaskForm.tsx` (Zod schema)                                          | Chặn submit tại client, báo lỗi đỏ ngay dưới ô nhập nhãn.                                                                                                                                                                                      | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 2.2)                                                                |
| **Hạn chót nằm trong quá khứ**                                     | _"Lưu ý: Hạn chót đã qua so với hôm nay."_                                                                                       | `apps/web/src/features/tasks/TaskForm.tsx`, `TaskDetailDrawer.tsx`                               | Cảnh báo màu hổ phách (`#b45309`) nhắc nhở, không cấm hẳn để cho phép nhập việc bổ sung.                                                                                                                                                       | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 2.4 & 3.2)                                                          |
| **Gõ Enter trong ô thêm việc con (Checklist)**                     | Thêm mục vào checklist                                                                                                           | `apps/web/src/features/tasks/TaskForm.tsx`                                                       | Bắt sự kiện `onKeyDown` (Enter), gọi `e.preventDefault()` để không submit form chính ngoài ý muốn.                                                                                                                                             | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 2.3)                                                                |
| **Lỗi máy chủ nội bộ (`500 Internal Server Error`)**               | _"Máy chủ đang bận. Dữ liệu của bạn vẫn được giữ nguyên, vui lòng thử lại."_                                                     | `apps/web/src/features/tasks/TaskForm.tsx`, `apiClient.ts`                                       | Giữ nguyên dữ liệu trên form, không xóa trường nhập, thông báo rõ ràng.                                                                                                                                                                        | `apps/web/src/test/user-errors-b2.test.tsx` (13 tests - Test 2.5)                                                                |
| **Lỗi trình duyệt/Private Mode (`localStorage` đầy hoặc bị chặn)** | Ghi log cảnh báo `console.warn`, fallback in-memory                                                                              | `apps/web/src/lib/safeStorage.ts` (`safeStorage`)                                                | Bọc an toàn `getItem`, `setItem`, `removeItem`, chống văng ngoại lệ `QuotaExceededError` / `SecurityError`.                                                                                                                                    | `apps/web/src/test/error-handling.test.tsx` (15 tests)                                                                           |
| **Crash View Component (Lịch, Thống kê, Focus, Kanban)**           | _"Không thể tải [Tên View]. Vui lòng bấm thử lại."_                                                                              | `apps/web/src/components/ui/ViewErrorBoundary.tsx`                                               | React Error Boundary cô lập crash, giữ nguyên thanh điều hướng và phần còn lại của ứng dụng.                                                                                                                                                   | `apps/web/src/test/error-handling.test.tsx` (15 tests)                                                                           |

---

### 2.2. Tầng Máy chủ (Backend - `apps/api`)

| Trường hợp thao tác                                                   |      Mã HTTP      | Thông báo / Phản hồi JSON                                                       | Tệp tin xử lý                                                                      | Test chứng minh (Số test thực tế)                                     |
| :-------------------------------------------------------------------- | :---------------: | :------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **ID công việc / danh sách sai cú pháp** (không phải ObjectId 24 hex) | `400 Bad Request` | `{ "error": { "message": "Mã định danh công việc không hợp lệ." } }`            | `apps/api/src/modules/tasks/routes.ts`, `apps/api/src/middlewares/errorHandler.ts` | `apps/api/src/modules/tasks/tests/error-resilience.test.ts` (7 tests) |
| **Cập nhật sai phiên bản (OCC Conflict)**                             |  `409 Conflict`   | `{ "error": { "message": "Công việc đã được người khác cập nhật." } }`          | `apps/api/src/modules/tasks/service.ts`                                            | `apps/api/src/modules/tasks/tests/tasks.test.ts` (23 tests)           |
| **Công việc không tồn tại khi sửa/xóa/đổi trạng thái**                |  `404 Not Found`  | `{ "error": { "message": "Không tìm thấy công việc." } }`                       | `apps/api/src/modules/tasks/service.ts`                                            | `apps/api/src/modules/tasks/tests/tasks.test.ts` (23 tests)           |
| **Việc lặp lại nhưng không có hạn chót**                              | `400 Bad Request` | `{ "error": { "message": "Việc lặp lại cần hạn chót." } }`                      | `apps/api/src/modules/tasks/schema.ts`                                             | `apps/api/src/modules/tasks/tests/foundation.test.ts` (26 tests)      |
| **Tiêu đề trống hoặc dài hơn 160 ký tự**                              | `400 Bad Request` | `{ "error": { "message": "Nhập tiêu đề công việc." } }`                         | `apps/api/src/modules/tasks/schema.ts`                                             | `apps/api/src/modules/tasks/tests/foundation.test.ts` (26 tests)      |
| **Thao tác danh sách người khác (Không thuộc cặp đôi)**               |  `403 Forbidden`  | `{ "error": { "message": "Bạn không có quyền thao tác trên danh sách này." } }` | `apps/api/src/modules/tasks/service.ts`                                            | `apps/api/src/modules/tasks/tests/foundation.test.ts` (26 tests)      |
| **Tính chuỗi thống kê (Stats Streak) khi ngày không liên tục**        |     `200 OK`      | Tính toán an toàn, trả về số ngày liên tiếp chính xác, không tràn mốc           | `apps/api/src/modules/tasks/service.ts`                                            | `apps/api/src/modules/tasks/tests/stats.test.ts` (10 tests)           |
| **Cửa sổ thói quen trễ hạn (lateHabits)**                             |     `200 OK`      | Lấy đúng cửa sổ thời gian (7d/30d/90d), không lỗi chia cho 0                    | `apps/api/src/modules/tasks/service.ts`                                            | `apps/api/src/modules/tasks/tests/stats.test.ts` (10 tests)           |

---

## 3. Kịch bản kiểm thử thủ công (Manual Test Checklist - 10 Ca oái oăm)

Chủ dự án hoặc người kiểm thử có thể thực hiện 10 bước sau trên trình duyệt thật để tự tay nghiệm thu khả năng chịu lỗi của hệ thống:

```markdown
[ ] 1. ĐANG SỬA THÌ MẤT MẠNG: - Mở một việc để sửa trong form hoặc drawer. - Tắt Wi-Fi / bật Airplane mode trên máy tính. - Bấm nút "Lưu". - KẾT QUẢ ĐÚNG: Nút bấm disabled hoặc hiện thông báo "Mất kết nối", toàn bộ nội dung vừa gõ vẫn NGUYÊN VẸN trong form, không bị đóng hay mất chữ.

[ ] 2. XUNG ĐỘT SỬA ĐỔI GIỮA HAI NGƯỜI (409 CONFLICT): - Mở 2 tab trình duyệt cùng xem việc chung A (Tab 1 và Tab 2). - Ở Tab 1: Sửa tiêu đề thành "A1" và Lưu thành công. - Ở Tab 2 (vẫn đang mở bản cũ): Sửa tiêu đề thành "A2" và Lưu. - KẾT QUẢ ĐÚNG: Tab 2 hiện banner xung đột màu vàng ấm áp: "Công việc đã được người khác cập nhật. Nội dung đang nhập được giữ." cùng 2 nút hành động: + Bấm "Xem bản mới": nạp ngay dữ liệu mới "A1" từ máy chủ, bỏ bản nháp đang gõ. + Bấm "Giữ bản của tôi": tự động lấy revision mới nhất từ server và ghi đè "A2" lên, lưu thành công mà không phải gõ lại.

[ ] 3. MỘT NGƯỜI ĐÃ XÓA, NGƯỜI KIA BẤM HOÀN THÀNH (404 NOT FOUND): - Mở 2 tab trình duyệt cùng xem danh sách việc. - Ở Tab 1: Xóa vĩnh viễn việc B. - Ở Tab 2: Bấm tick hoàn thành việc B. - KẾT QUẢ ĐÚNG: Tab 2 báo "Dữ liệu không tồn tại hoặc đã bị xóa", hàng việc B tự động biến mất khỏi danh sách ở Tab 2, không gây crash ứng dụng.

[ ] 4. DÁN 100 DÒNG TỪ WORD / EXCEL / NOTEPAD: - Copy 100 dòng văn bản bất kỳ. - Dán vào ô "Thêm nhanh" (`QuickAddBar`). - KẾT QUẢ ĐÚNG: Hiện cảnh báo "Bạn đang dán 100 dòng... chỉ hỗ trợ tối đa 50 việc cùng lúc", có nút "Chỉ giữ 50 việc đầu tiên". Bấm nút thì tự động cắt đúng 50 dòng an toàn.

[ ] 5. NHẬP NHÃN KÈM DẤU THĂNG (#NHÀ, #CHỢ, #NHÀ): - Mở form tạo việc, nhập vào ô Nhãn: `#siêu_thị, #chợ, #siêu_thị, ##nhà`. - Bấm Lưu. - KẾT QUẢ ĐÚNG: Hệ thống tự động bóc tách thành 3 nhãn sạch sẽ: `siêu_thị`, `chợ`, `nhà` (loại bỏ `#` và lọc trùng lặp).

[ ] 6. GÕ ENTER KHI ĐANG NHẬP VIỆC CON (CHECKLIST): - Mở form tạo việc mới, gõ tiêu đề "Đi chợ". - Chuyển xuống ô "Nội dung việc con", gõ "Mua rau", rồi ấn phím Enter. - KẾT QUẢ ĐÚNG: Mục "Mua rau" được thêm ngay vào danh sách việc con bên dưới, con trỏ sẵn sàng nhập tiếp, FORM CHÍNH KHÔNG BỊ SUBMIT BẤT NGỜ.

[ ] 7. CHỌN HẠN CHÓT QUÁ KHỨ (NGÀY HÔM QUA): - Mở form tạo việc hoặc drawer chi tiết, chọn hạn chót lùi về 3 ngày trước. - KẾT QUẢ ĐÚNG: Dưới ô ngày hiển thị dòng nhắc màu hổ phách: "Lưu ý: Hạn chót đã qua so với hôm nay", nhưng vẫn cho phép lưu để phục vụ ghi chép việc đã làm.

[ ] 8. BẤM NHẤP ĐÚP CHUỘT LIÊN TỤC VÀO NÚT "LƯU" / "HOÀN THÀNH": - Bấm 5 lần thật nhanh vào nút "Lưu" hoặc tick hoàn thành. - KẾT QUẢ ĐÚNG: Nút chuyển ngay sang trạng thái busy/disabled sau cú bấm đầu tiên, Network tab chỉ gửi duy nhất 1 request API, không sinh ra việc trùng lặp.

[ ] 9. THỬ GÕ KÝ TỰ ĐẶC BIỆT VÀ TIẾNG VIỆT TỔ HỢP TRÊN ĐIỆN THOẠI: - Gõ tiêu đề tiếng Việt có dấu với bộ gõ Telex / VNI phức tạp: "Đã kiểm tra kỹ lưỡng ổi & xoài 🌱". - KẾT QUẢ ĐÚNG: Hiển thị tròn vành rõ chữ, không bị lỗi font tổ hợp, không bị rớt dấu khi lưu lên MongoDB và đọc lại.

[ ] 10. CHUYỂN BỘ LỌC KHIẾN DANH SÁCH RỖNG: - Đang xem danh sách, lọc "Giao cho tôi" + Trạng thái "Đã hủy" (không có việc nào thỏa mãn). - KẾT QUẢ ĐÚNG: Huy hiệu bộ lọc hiện "Bộ lọc · 2", màn hình hiện Empty State lịch sự: "Chưa có công việc phù hợp — Thêm việc mới hoặc thay đổi bộ lọc", có nút "Đặt lại bộ lọc" để 1-click đưa danh sách trở lại bình thường.
```

---

## 4. Báo cáo kích thước gói đóng gói (Bundle Size)

Tối ưu hóa phân rã mã nguồn (Code-Splitting) sau khi hoàn thành Phase B4:

| Chunk đóng gói             | Kích thước Raw | Kích thước Gzip | Ghi chú tải trang                           |
| :------------------------- | :------------: | :-------------: | :------------------------------------------ |
| `TasksPage-KHZ_O68f.js`    | **141.19 kB**  |  **45.50 kB**   | Chunk chính của trang To-do sau khi phân rã |
| `CalendarView-BmlQ-oFD.js` |  **3.31 kB**   |   **1.68 kB**   | Lazy-load chỉ khi người dùng bấm tab Lịch   |
| `FocusMode-BGE8bUaZ.js`    |  **5.32 kB**   |   **2.21 kB**   | Lazy-load chỉ khi vào chế độ Tập trung      |
| `StatsPanel-fWfftNEy.js`   |  **12.19 kB**  |   **3.69 kB**   | Lazy-load khi mở tab Thống kê               |
| `ShoppingView-BSXhSGo_.js` |  **0.86 kB**   |   **0.63 kB**   | Lazy-load khi xem danh sách mua sắm         |

**Kết luận:** Trang To-do khởi động nhẹ nhàng, không phình to bất thường, các tính năng nặng được nạp động theo nhu cầu thực tế (progressive disclosure).

---

## 5. Các mục chưa kiểm trên trình duyệt thật & Kịch bản kiểm tay từng bước

Bộ test tự động trong CI/Vitest sử dụng môi trường giả lập JSDOM. Các kịch bản trải nghiệm phần cứng và môi trường mạng thực tế sau đây cần chủ dự án tự tay kiểm tra trên thiết bị thực tế trước khi phát hành rộng rãi:

### 5.1. Màn hình di động hẹp (375px - iPhone SE / Mini)

- **Mục tiêu:** Đảm bảo drawer chi tiết công việc, thanh công cụ và danh sách việc con không bị vỡ giao diện hoặc tràn thanh cuộn ngang (horizontal scroll).
- **Cách kiểm tra:**
  1. Mở DevTools trên Chrome/Firefox/Safari (F12 hoặc Cmd+Opt+I).
  2. Bật chế độ Responsive (Ctrl+Shift+M) và chọn kích thước màn hình `375 x 667` (iPhone SE).
  3. Mở một công việc có checklist dài và mô tả dài.
  4. **Kiểm tra đạt:** Nội dung co giãn trơn tru trong phạm vi 375px, 2 nút "Xem bản mới" và "Giữ bản của tôi" xếp chồng hoặc xuống dòng gọn gàng, không bị tràn viền.

### 5.2. Hai tài khoản thao tác đồng thời (Concurrent Couples Edit)

- **Mục tiêu:** Xác minh luồng thông báo xung đột 409 khi 2 người cùng sửa một việc chung.
- **Cách kiểm tra:**
  1. Mở 2 trình duyệt khác nhau (hoặc 1 cửa sổ thường và 1 cửa sổ Ẩn danh/Incognito).
  2. Đăng nhập tài khoản A (`minh.demo@mamchung.test`) trên Cửa sổ 1 và tài khoản B (`an.demo@mamchung.test`) trên Cửa sổ 2.
  3. Cả 2 cùng mở việc chung "Đi siêu thị cuối tuần".
  4. Tài khoản A thêm việc con "Mua táo" và bấm Lưu (lưu thành công).
  5. Tài khoản B sửa tiêu đề thành "Đi siêu thị Big C" và bấm Lưu.
  6. **Kiểm tra đạt:** Tài khoản B hiện banner màu hổ phách ấm áp: "Công việc đã được người khác cập nhật. Nội dung đang nhập được giữ." Thử bấm "Xem bản mới" -> tải đúng việc con "Mua táo" của A; hoặc thử bấm "Giữ bản của tôi" -> lưu đè thành công tiêu đề của B.

### 5.3. Mạng chập chờn / Mất kết nối đột ngột (Offline Simulation)

- **Mục tiêu:** Kiểm tra khả năng giữ nháp và chặn submit khi mất kết nối.
- **Cách kiểm tra:**
  1. Mở drawer sửa công việc, gõ thêm nội dung vào ô Mô tả.
  2. Trong DevTools > Network tab, đổi tốc độ mạng từ _No throttling_ sang _Offline_ (hoặc ngắt Wi-Fi máy tính).
  3. Bấm "Lưu ngay".
  4. **Kiểm tra đạt:** Dòng trạng thái hiện _"Mất kết nối · Chưa lưu"_, toàn bộ chữ vừa gõ giữ nguyên vẹn. Bật mạng trở lại -> bấm Lưu -> lưu thành công.

### 5.4. Chế độ giảm chuyển động (`prefers-reduced-motion`)

- **Mục tiêu:** Người dùng nhạy cảm với hiệu ứng thị giác không bị chóng mặt bởi các chuyển động lướt mở drawer hoặc tab.
- **Cách kiểm tra:**
  1. Trong DevTools > Command Palette (Ctrl+Shift+P), gõ `Show Rendering` > tìm mục `Emulate CSS media feature prefers-reduced-motion` > chọn `prefers-reduced-motion: reduce`.
  2. Thao tác chuyển tab danh sách và mở drawer chi tiết.
  3. **Kiểm tra đạt:** Các chuyển cảnh mở drawer diễn ra tức thì hoặc fade nhẹ, không có hiệu ứng trượt trôi giật mắt.
