# To-do List — Giai đoạn C: Giao diện lõi

Hoàn tất ngày2026-10-06. Dừng sau C để người dùng kiểm tra theo kế hoạch đã xác nhận.

## Đã làm

- Sidebar: tám smart lists theo prompt và Tất cả, số đếm toàn bộ theo quyền, danh sách cá nhân/chung, nhãn, tạo danh sách/màu và lưu trữ/mở lại.
- Header chào/ngày và ring DONE/tổng việc đến hạn hôm nay, không phải thống kê hoàn thành theo ngày. Có trạng thái chưa tải rõ, lỗi và retry.
- Quick add tiêu đề thuần, giữ context danh sách, input sticky. Nút+ nổi trên Tasks tạo việc tại context ấy, không dẫn sang Tài chính. Natural parser/chip thuộc D.
- Bộ lọc/view/group trong URL. Nhóm Quá hạn/Hôm nay/Ngày mai/Tuần này/Sau đó/Không hạn/Đã hủy/Đã xong; nhóm terminal đóng mặc định. Có nhóm theo list/priority/assignee. Page20 giữ pagination, số nhóm thuộc trang.
- TaskRow checkbox tròn, ưu tiên/hạn/nhãn/checklist/avatar, trạng thái, nút sửa/xóa/bình luận. Kanban cũ4 cột được giữ, chuyển trạng thái bằng select; kéo thả chưa làm trong C.
- Drawer420px với Modal portal/focus trap/Esc; mobile full viewport. Tự lưu650ms, revision cập nhật theo response, draft giữ khi lỗi; retry hoặc bỏ thay đổi rõ. Checklist thêm Enter/tick/sửa/xóa. Giao việc/list/nhãn/hạn có giờ/ước lượng/lặp cơ bản có thể sửa.
- Optimistic tick/status/checklist/delete, rollback theo task khi lỗi, không ghi đè cache task khác. Undo5 giây khi hoàn thành/xóa; có undo trong drawer để keyboard dùng được. Restore backend giữ ID, giới hạn30 ngày và kiểm tra quyền/revision.
- Skeleton hàng việc, empty states theo smart list, lỗi có retry, block writes offline. CSS theo token, vùng bấm mobile44px, reduced-motion.

## File mới

- apps/web/src/features/tasks/components/SmartListSidebar.tsx
- apps/web/src/features/tasks/components/TaskRow.tsx
- apps/web/src/features/tasks/components/TaskHeader.tsx
- apps/web/src/features/tasks/components/TaskGroup.tsx
- apps/web/src/features/tasks/components/TaskDetailDrawer.tsx
- apps/web/src/features/tasks/lib/dateLabels.ts
- apps/web/src/features/tasks/lib/useOnline.ts
- apps/web/src/features/tasks/store/index.ts
- apps/web/src/features/tasks/useTaskWrite.ts
- apps/web/src/test/tasks-core.test.tsx
- docs/TASKS_PHASE_C.md

## File sửa

- apps/web/src/features/tasks/TasksPage.tsx, TaskForm.tsx, api.ts
- apps/web/src/components/ui/Modal.tsx (variant drawer, giữ hành vi modal cũ)
- apps/web/src/app/App.tsx, apps/web/src/styles/global.css
- apps/api/src/modules/tasks/service.ts, routes.ts, openapi.ts
- apps/api/src/modules/tasks/tests/foundation.test.ts (thêm3 test, chỉnh kiểm tra list archived cho truy vấn list tường minh)
- docs/API.md, docs/DECISIONS.md, README.md

Thay đổi FitnessPage/fitness.test từ lần sửa timer trước vẫn được giữ ngoài commit Công việc.

## Kiểm chứng

- Backend toàn bộ:266/266 test,12 suites, thêm3 test số đếm/quyền/restore. Công việc riêng45 test đạt.
- Frontend toàn bộ:171/171 test,12 files, thêm13 test trong tasks-core. Giữ15 test Công việc cũ. Sau thay đổi cuối của nút thêm nổi, chạy lại42 test thuộc Tasks/Tasks core/App và đều đạt.
- Tổng437 test đạt qua các bộ chạy. Coverage task service:statements99.01%, branches92.10%, functions100%, lines99.64%.
- Typecheck/lint toàn dự án đạt; frontend được kiểm tra lại sau chốt. Build API/frontend đạt; PWA bản build cuối đạt:31 public files,3 PNG icons,chunk lớn nhất411704 bytes,0 private cache và0 placeholders. Prettier/diff check đạt.
- Backend local khởi động lại: health ok/database connected, /tasks HTTP200, /api/tasks/summary không đăng nhập401. Swagger có summary/restore, không thiếu schema reference.
- Không chạy migration thêm ở C vì không đổi schema DB; migration B đã chuyển đổi dữ liệu local.
- CUA thử khởi tạo thất bại: failed to write kernel assets / os error3. Chưa có ảnh hoặc kiểm chứng trực quan trên Cốc Cốc/375px, không tuyên bố đã qua browser E2E hay chứng nhận WCAG. CSS/RTL/build không thay cho kiểm tra đó.

## Chạy và kiểm tra bằng tay

Từ E:/mam-chung:

```sh
npm run dev:local
npm run lint
npm test
npm run build
npm run check:pwa
npm run test -w @mam-chung/web -- src/test/tasks.test.tsx src/test/tasks-core.test.tsx
```

Nếu bản local đang chạy, mở http://127.0.0.1:5173/tasks và F5, không mở thêm bản dev:local trùng cổng.

1. Bấm Hôm nay/Quá hạn/Giao cho tôi; kiểm tra số đếm và dữ liệu của mình. Tạo danh sách rồi thêm một việc ở đó; tải lại URL vẫn đúng bộ lọc.
2. Tick hoàn thành; bấm Hoàn tác trong5 giây. Xóa có xác nhận, hoàn tác khôi phục cùng việc. Với việc lặp, bản kế tiếp đã sinh vẫn được giữ.
3. Bấm tên việc: sửa title/description/hạn, đợi Đã lưu. Sửa tiếp để kiểm tra revision. Esc đóng khi sạch; draft lỗi được giữ, Bỏ thay đổi và đóng là thao tác tường minh.
4. Mở drawer, chuyển DONE và dùng nút Hoàn tác trong drawer bằng bàn phím. Tab/ShiftTab giữ focus trong ngăn.
5. Tắt mạng: checkbox/input ghi bị khóa. Với lỗi mạng/API trong lúc ghi, nội dung không bị mất và task rollback.
6. Hai tài khoản cùng couple thử việc chung; bên kia thấy khi focus/refetch hoặc tối đa15 giây. Private tasks/labels không lộ. Couple lịch sử và danh sách archived chỉ đọc; mở lại list archived cá nhân/chung active qua sidebar.
7. Kiểm tra viewport375px và prefers-reduced-motion trên trình duyệt thực; mục này còn chờ xác minh trực quan.

## Quyết định và bước tiếp

Xem docs/DECISIONS.md mục Giai đoạn C. Tái sử dụng Service, revision, polling/cache, Modal và checklist/bình luận có sẵn. Core drawer plain text; các trường reminder/job/activity/rich text và calendar/Focus/nudge/templates thuộc E.

D tiếp theo: parseQuickAdd tiếng Việt + chips, kéo thả có keyboard, chọn nhiều/bulk, phím tắt, tìm kiếm debounce/highlight và mobile swipe. Chưa tự triển khai D trước khi người dùng kiểm tra C.
