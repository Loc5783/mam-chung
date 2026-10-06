# To-do List — Giai đoạn D: Thêm nhanh và tương tác

Ngày 2026-10-06. Dừng sau D theo kế hoạch A–F đã xác nhận.

## Đã làm

- Hàm thuần `parseQuickAdd(text, now, context)` với 58 kiểm tra: ngày tiếng Việt, giờ, ưu tiên, nhãn, người được giao, danh sách, không gian chung, lặp lại, cảnh báo trường hợp mơ hồ, múi giờ và trả chữ về tiêu đề khi gỡ chip.
- Thanh thêm nhanh có tiêu đề xem trước, chip sửa/gỡ, tùy chọn giữ nguyên văn. Enter thêm một việc, Shift+Enter xuống dòng. Dán nhiều dòng phải xác nhận; tối đa 100 việc. Lỗi giữ nguyên nội dung để sửa/thử lại.
- Một việc dùng POST /api/tasks hiện có; nhiều việc dùng POST /api/tasks/quick-add. Backend dùng chung createTask, kiểm tra bằng Zod và service, lấy chủ sở hữu/couple từ token. Cả nhóm được tạo trong một transaction; một việc sai thì cả nhóm và Inbox vừa tạo đều rollback.
- Kéo thả bằng @dnd-kit, có KeyboardSensor và nút lên/xuống. Sidebar sắp xếp danh sách trong cùng chủ sở hữu/couple. Công việc sắp xếp khi chọn một danh sách và chọn Thứ tự thủ công. Backend vẫn cấp khóa fractional; client lấy đủ các trang để xác định hàng xóm thật trước khi lưu, không đoán thứ tự từ một trang hoặc nhóm lọc.
- Chọn việc bằng checkbox trên mọi thiết bị, Ctrl/Cmd-click để chọn/bỏ chọn hàng, Shift-click chọn khoảng trong trang. Thanh hàng loạt có hoàn thành, hạn, ưu tiên, giao việc, danh sách, gắn nhãn và xóa có xác nhận. Gắn nhãn giữ nhãn cũ, vượt 10 nhãn thì rollback cả nhóm.
- PATCH /api/tasks/bulk-undo khôi phục từng trạng thái/giá trị gốc hoặc việc xóa mềm trong một transaction, bắt buộc revision mới. Có hoàn tác nhóm và dời hạn trong 5 giây; từ chối phiên bản cũ hoặc tài nguyên ngoài quyền.
- Phím tắt N, /, J/K, X, E, T, Delete, ?, Ctrl/Cmd+Z. Không chặn việc nhập trong input/textarea/select/contenteditable, modal hoặc điều khiển kéo thả. Esc dùng cơ chế đóng/focus trap hiện có.
- Tìm kiếm chờ gõ 250 ms, URL vẫn giữ câu tìm kiếm; tô từ khóa trong tiêu đề. Vuốt ngang trên hàng bằng cảm ứng: phải hoàn thành, trái mở dời ngày mai/xóa. Không nhận thao tác cuộn dọc, bắt đầu trên nút/input hoặc pointer bị hủy.
- Nút + mở bảng thêm nhanh; mobile có bảng từ dưới lên và safe-area. Giữ chặn ghi khi mất kết nối và khi xem hành trình lưu trữ.
- Cập nhật OpenAPI cho quick-add, thêm nhãn và hoàn tác nhóm.

## File mới

- apps/web/src/features/tasks/lib/parseQuickAdd.ts
- apps/web/src/features/tasks/lib/parseQuickAdd.test.ts
- apps/web/src/features/tasks/components/QuickAddBar.tsx
- apps/web/src/features/tasks/components/BulkActionBar.tsx
- apps/web/src/features/tasks/components/SortableTaskList.tsx
- apps/web/src/features/tasks/components/SortableLists.tsx
- docs/TASKS_PHASE_D.md

## File sửa

- apps/api/src/modules/tasks/{service,schema,routes,operations,openapi}.ts
- apps/api/src/modules/tasks/tests/foundation.test.ts
- apps/web/src/features/tasks/TasksPage.tsx và api.ts
- apps/web/src/features/tasks/components/{SmartListSidebar,TaskRow}.tsx
- apps/web/src/test/tasks-core.test.tsx
- apps/web/src/styles/global.css
- apps/web/package.json và package-lock.json
- docs/DECISIONS.md, README.md

## Kiểm tra

```powershell
cd E:\mam-chung
npm run lint
npm run test
npm run build
npm run dev:local
```

Kết quả kiểm tra cuối:

- Web: 239 kiểm tra toàn bộ đạt; 81 kiểm tra parser/giao diện core chạy lại đạt sau chỉnh sửa chip nhiều dòng. So với C có 68 kiểm tra mới: 58 parser và 10 tương tác.
- Backend: 26 kiểm tra foundation đạt, gồm 7 kiểm tra mới cho quick-add, gắn nhãn, hoàn tác và phân quyền. Toàn bộ backend: 273/273 đạt, 12 suite. Coverage tasks/service: statements 99.04%, branches 92.10%, functions 100%, lines 99.65%.
- Lint/typecheck và build đã đạt. PWA: 31 tài nguyên công khai, 3 icon, 0 file cache riêng tư, 0 placeholder. OpenAPI đang chạy có /api/tasks/quick-add và /api/tasks/bulk-undo. Website /tasks và API /api/health trả HTTP 200.
- Trình duyệt trong app đã mở và hiển thị trang Công việc với dữ liệu thật. Các luồng ghi mới được kiểm tra qua API và RTL; chưa kiểm tra kéo thả bằng chuột thật, vuốt trên thiết bị thật hoặc toàn bộ luồng hai tài khoản trên trình duyệt. Kiểm tra giao diện 375px và hiệu năng/a11y toàn diện tiếp tục ở F.

## Cách thử

1. Mở http://127.0.0.1:5173/tasks, gõ `Đóng tiền nhà mai 9h !khẩn #hóa-đơn @tôi`. Kiểm tra ngày, giờ, ưu tiên, nhãn và người giao trên chip; bấm Sửa/Gỡ một chip rồi xem tiêu đề trước khi Thêm.
2. Dán hai dòng việc. Chọn Thêm, kiểm tra hộp xác nhận trước khi lưu. Với @người-không-tồn-tại sẽ có cảnh báo và chặn lưu; có thể giữ nguyên văn khi muốn chữ đó thuộc tiêu đề.
3. Chọn danh sách Hộp thư vào, đặt Sắp xếp = Thứ tự thủ công. Kéo tay nắm, hoặc focus tay nắm rồi Space → mũi tên → Space; Esc hủy. Các nút lên/xuống là phương án thay thế. Đổi bộ lọc không đổi quyền truy cập.
4. Chọn vài checkbox, đổi ưu tiên/hạn/gắn nhãn. Hoàn thành/xóa/chuyển danh sách xong thử Hoàn tác nhóm trong 5 giây. Khi có một revision cũ, cả nhóm bị từ chối.
5. Bấm N, nhập việc; các chữ X/T/E trong ô nhập không kích hoạt thao tác. Ra ngoài ô nhập rồi J/K di chuyển, X hoàn thành, Ctrl+Z hoàn tác. Bấm ? xem hướng dẫn.
6. Trên điện thoại vuốt phải trên vùng trống của hàng để hoàn thành, trái để mở hành động. Cuộn dọc vẫn dùng bình thường; xóa vẫn hỏi xác nhận.

## Quyết định và giới hạn

- Tất cả ngày dựa theo múi giờ tài khoản. `thứ 6` có thể là hôm nay nếu hôm nay là thứ 6; `cuối tuần` là thứ 7 gần nhất hoặc ngày hiện tại nếu đang cuối tuần. `tuần sau` = +7 ngày. Chip luôn hiện ngày cụ thể.
- !1 = Khẩn, !2 = Cao, !3 = Vừa, !4 = Thấp. `chiều` = 15:00, `tối` = 20:00, giờ không có ngày áp dụng ngày hiện tại hoặc ngữ cảnh đã chọn, có ngày cụ thể trên chip.
- `hằng thứ 2` dùng recurrence weekly và ngày bắt đầu đúng thứ, tái sử dụng nghiệp vụ lặp B. Không bổ sung một scheduler khác.
- Parser chỉ nhận cú pháp được công bố; từ không nhận diện giữ nguyên tiêu đề. Tên người/danh sách mơ hồ hoặc không tồn tại có cảnh báo, không tự tạo danh sách hay đoán người được giao.
- Chọn khoảng và J/K áp dụng các hàng đang hiển thị trong trang; pagination 20 việc được giữ. Kéo giữa các cột Kanban thuộc E. Ảo hóa >200 việc thuộc F.
- Không thay schema task hay migration B. Bộ API cũ được giữ nguyên. Thêm collection không cần thiết trong D.
- Các thay đổi Fitness có từ trước vẫn giữ nguyên ngoài phạm vi commit D.

## Tiếp theo

Giai đoạn E: Kanban kéo thả chuyển trạng thái, Lịch, Focus, nhắc nhở in-app, nhắc nhẹ, dòng hoạt động, mẫu danh sách và danh sách mua sắm. Chưa triển khai E trong lượt này.

Tích hợp kéo thả dùng API chính thức: [Sortable](https://dndkit.com/legacy/presets/sortable/overview/), [Keyboard sensor](https://dndkit.com/legacy/api-documentation/sensors/keyboard/).
