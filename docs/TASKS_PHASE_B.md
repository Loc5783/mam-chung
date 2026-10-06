# To-do List — Giai đoạn B: Nền tảng dữ liệu

Hoàn tất ngày 2026-10-06. Giữ giao diện Công việc hiện có; bố cục mới thuộc C. Không thực hiện chat, email/SMS, AI, native hoặc real-time.

## Đã làm

- TaskList cá nhân/chung, Inbox/Việc chung mặc định, màu/icon trong bảng màu dự án, revision, lưu trữ/mở lại và xóa với lựa chọn chuyển việc hoặc xóa mềm.
- Trường nền tảng task: listId, position, startDate, deadlineHasTime/time/timezone, reminderAt, estimateMinutes, timeSpentSeconds, completedBy; giữ checklist/labels/recurrence/completedAt/deletedAt cũ.
- Quyền tại Service, token xác định actor, couple active xác minh bằng DB. Dữ liệu archived giữ chỉ đọc; client không tự gán owner/couple hoặc completedBy/timeSpent/position.
- Smart filters, q/assignee/list/groupBy/manual; giữ bộ lọc cũ. Paging/sort ở MongoDB thay vì tải toàn bộ task vào Node để chia trang.
- Reorder ghi một hàng bằng khóa base62 phân đoạn. Bulk 1–100 việc có revision, validate toàn bộ và transaction; lỗi không lưu một phần, ID sai quyền/phiên bản trả trong error.details.
- Migration mặc định dry-run, preflight dữ liệu, backup Extended JSON khi apply, transaction theo owner/couple, giữ thứ tự cũ và dữ liệu đã chỉnh, chạy lại không làm hỏng dữ liệu.
- Swagger và tài liệu cập nhật. Task types frontend mở rộng tùy chọn để tương thích phiên bản API/fixtures trước.

## File mới

- apps/api/src/modules/tasks/access.ts — quyền dùng chung.
- apps/api/src/modules/tasks/lists.ts — schema và Service danh sách.
- apps/api/src/modules/tasks/operations.ts — bulk/reorder task.
- apps/api/src/modules/tasks/position.ts — khóa thứ tự.
- apps/api/src/modules/tasks/migration.ts — migration có dry-run.
- apps/api/src/modules/tasks/tests/foundation.test.ts — 16 kiểm thử mới.
- apps/api/src/scripts/migrate-tasks.ts — CLI và backup trước apply.
- docs/TASKS_PHASE_B.md — báo cáo giai đoạn này.

## File sửa

- apps/api/src/modules/tasks/models.ts, schema.ts, service.ts, routes.ts, openapi.ts.
- apps/api/src/modules/tasks/tests/tasks.test.ts — thêm 1 test completedBy, giữ 25 test cũ.
- apps/api/package.json — lệnh migrate:tasks.
- apps/web/src/features/tasks/types.ts — kiểu dữ liệu bổ sung, không thay UI.
- README.md, docs/API.md, docs/DECISIONS.md.

Hai file FitnessPage.tsx/fitness.test.tsx đã có thay đổi từ lần sửa bộ đếm trước giai đoạn B; không gộp vào commit nâng cấp Công việc.

## Kiểm chứng

- npm test: API 263/263 (12 suites), frontend 158/158 (11 files). Tổng421 test đạt. Công việc riêng42 test backend (25 cũ +17 mới), frontend15 test cũ đạt trong bộ chung.
- Coverage task service từ bộ toàn dự án: statements98.88%, branches91.08%, functions100%, lines99.59%. Lượt đo cả module bằng hai suite Công việc trước chốt: lists statements95.74%, operations93.58%; không đồng nhất số đó với branch coverage của từng helper.
- npm run lint: API/frontend typecheck và ESLint đạt.
- npm run build: API/frontend đạt.
- Prettier check các file Giai đoạn B và git diff --check đạt.
- npm run check:pwa: publicFiles29, pngIcons3, largestChunkBytes411704, privateCacheFiles0, placeholders0.
- Migration local: dry-run trước báo29 danh sách mặc định/19 task; apply tạo29 danh sách và cập nhật19 task; dry-run sau báo0/0. Không đổi quyền, status hoặc completedAt/deletedAt của task hiện có.
- Backup local trước apply: E:/mam-chung/.local/task-migration-backups/1791291332711-tasks.json. Extended JSON gồm tasks/task_lists; không phải backup toàn database.
- Khởi động lại local sau migration: API health ok/database connected; web /tasks HTTP200; API task-lists chưa đăng nhập401; OpenAPI có task-lists/bulk/reorder, không thiếu schema reference.
- Không kiểm chứng trình duyệt trực tiếp hoặc mobile375px trong B; không coi kiểm thử HTTP/build là kiểm tra UI.

## Lệnh chạy lại

Từ E:/mam-chung:

```sh
npm test
npm run lint
npm run build
npm run check:pwa
npm run test -w @mam-chung/api -- --runTestsByPath src/modules/tasks/tests/tasks.test.ts src/modules/tasks/tests/foundation.test.ts --coverage=false
npm run migrate:tasks -w @mam-chung/api -- --dry-run
```

Lệnh migration cần MONGODB_URI đúng database replica set. Bản local hiện tại: mongodb://127.0.0.1:27118/mam_chung_local?replicaSet=mam-chung-local. Chỉ dùng --apply khi muốn thực sự chuyển đổi; dry-run không ghi. Test Jest tự tạo DB riêng, không dùng URI local ở trên.

## Kiểm tra bằng tay

1. Mở http://127.0.0.1:5173/tasks và F5; CRUD, status, checklist, nhãn, shopping và Kanban cũ tiếp tục dùng được.
2. Mở Swagger http://127.0.0.1:4000/api/docs, dùng access token của phiên thử để thử POST/GET task-lists, task tạo vào listId cùng phạm vi, reorder/bulk với revision từ GET. Không đưa token vào tài liệu hoặc mã nguồn.
3. Với hai tài khoản trong couple thử sửa task/list chung; tài khoản ngoài couple phải404. Danh sách cá nhân không xuất hiện ở tài khoản kia.
4. Reorder gửi afterId (hàng trước) và beforeId (hàng sau) liền nhau; stale revision409. Bulk trộn ID ngoài quyền phải thất bại toàn bộ.
5. Chạy dry-run lại: kết quả0/0 nếu không có người dùng/couple mới chưa có Inbox hoặc dữ liệu cũ mới xuất hiện.

## Quyết định và phạm vi tiếp theo

Chi tiết tại docs/DECISIONS.md, mục Nâng cấp Công việc — Giai đoạn B. Giữ deadline date-only + giờ/múi giờ riêng; smart filters theo ngày hồ sơ, upcoming ngày mai đến ngày thứ7, groups chỉ trang hiện tại. RecurrenceRule mới chỉ lưu nền tảng null; quy tắc mở rộng, nhắc giờ/reminder worker, templates, Focus, nhắc nhẹ và chuyển phạm vi thuộc E. Restore/undo sẽ làm cùng luồng giao diện tương ứng, không tuyên bố có trong B.

Dừng sau B theo yêu cầu. C tiếp theo: giao diện ba vùng thích ứng với sidebar chung, danh sách thông minh, nhóm theo hạn, TaskRow, ngăn chi tiết, trạng thái tải/rỗng/lỗi và optimistic update/rollback.
