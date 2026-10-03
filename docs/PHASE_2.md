# Báo cáo giai đoạn 2 — Tài chính cá nhân

## 1. Đã làm gì

- Ví tiền mặt/ngân hàng/điện tử, tên/màu/biểu tượng, số dư ban đầu, cho phép âm tùy chọn, lưu trữ/khôi phục và đối soát.
- 12 danh mục mặc định và danh mục riêng; sửa/xóa riêng có kiểm tra lịch sử và danh mục thay thế.
- Ghi/sửa/xóa/nhân bản thu chi, ghi chú/nhãn. Số dư và giao dịch luôn thay đổi trong một MongoDB transaction.
- Chuyển tiền hai ví: hai dòng liên kết, không tính vào thu/chi. Xóa cả cặp và hoàn nguyên hai ví nguyên tử.
- Lịch sử: tìm kiếm chuỗi, lọc ngày/ví/danh mục/loại, sắp xếp, phân trang và tổng toàn bộ kết quả lọc.
- Dashboard tài chính dùng dữ liệu thật của người đang đăng nhập: số dư, thu/chi theo tháng và múi giờ, so sánh tháng trước, donut theo danh mục, 5 dòng gần đây. Không bơm dữ liệu tiền mẫu vào tài khoản thật.
- UI Việt màu xanh cốm/hồng, desktop và điện thoại, loading/empty/error, modal xác nhận và focus trap gồm select/textarea.
- Swagger/OpenAPI request/response/query, tài liệu quyết định và hướng dẫn.

## 2. File mới/sửa

File mới:

- `apps/api/src/modules/finance/models.ts`, `schema.ts`, `repository.ts`, `service.ts`, `controller.ts`, `routes.ts`, `openapi.ts`, `tests/finance.test.ts`.
- `apps/api/src/seeds/categories.ts`, `apps/api/src/utils/dates.ts`.
- `apps/web/src/features/finance/types.ts`, `api.ts`, `FinancePage.tsx`, `FinanceOverview.tsx`, `FinanceForms.tsx`, `FinanceActions.tsx`, `FinanceIcon.tsx`.
- `apps/web/src/test/finance.test.tsx`, `docs/PHASE_2.md`.

File sửa:

- API `src/app.ts`, `config/db.ts`, `config/openapi.ts`, `middlewares/validate.ts`, `utils/money.ts`.
- Web `src/app/App.tsx`, `components/ui/Modal.tsx`, `features/dashboard/AccountHome.tsx`, `styles/global.css`, `test/app.test.tsx`.
- `README.md`, `docs/API.md`, `docs/DECISIONS.md`.

Ảnh kiểm tra riêng trong outputs: `mam-chung-phase-2.jpg`, `mam-chung-finance-mobile.jpg`. Số liệu trong ảnh là tài khoản QA giả lập, đã được vô hiệu hóa sau kiểm tra.

## 3. Cách chạy và kiểm tra

Mở thư mục repo, yêu cầu Node.js ≥20:

```powershell
npm ci
npm run dev:local
```

Đăng ký tại http://127.0.0.1:5173/register hoặc đăng nhập tại http://127.0.0.1:5173/login. Tài chính: http://127.0.0.1:5173/finance. Swagger: http://127.0.0.1:4000/api/docs.

Local runner dùng replica set riêng, giữ dữ liệu ở `.local/data`, secret riêng bị loại khỏi Git/Docker. Nếu sửa backend thì dừng và chạy lại runner. Docker chưa được kiểm tra vì máy chưa cài Docker.

```powershell
npm run lint
npm test
npm run build
npm run format:check
```

Jest dùng database replica set thử nghiệm riêng, không đụng dữ liệu local của bạn. Binary MongoDB có thể tái dùng qua MONGOMS_DOWNLOAD_DIR để tránh tải lại.

## 4. Kết quả kiểm tra

- Backend **68/68 test đạt**: 40 test tài chính mới và 28 test cũ. Bao gồm tăng/giảm số dư, thiếu tiền, sửa/xóa/type/ví, chuyển tiền/xóa cặp, rollback, ghi đồng thời, double-delete, phân quyền, danh mục, tìm kiếm/lọc/phân trang, tổng vượt số nguyên an toàn, múi giờ/DST, dashboard và đối soát.
- Frontend **35/35 test đạt**: 15 test tài chính mới và 20 test cũ. Kiểm tra ví/giao dịch/danh mục/chuyển tiền, lọc/phân trang, lỗi thiếu tiền, nhân bản, danh mục thay thế, xác nhận sửa đối soát và trạng thái trống.
- Coverage finance service: **99,66% statements, 94,39% branches, 100% functions, 99,64% lines**. Coverage toàn bộ service: **98,30% statements, 92,05% branches, 100% functions, 98,49% lines**. Vượt ngưỡng CI 80% ở cả bốn chỉ số.
- TypeScript/lint đạt. API/web build đạt. Vite còn cảnh báo bundle JavaScript lớn; tối ưu tải thuộc giai đoạn hoàn thiện.
- Kiểm tra trình duyệt: tạo khoản chi 15.000đ, sửa 20.000đ, tìm “Cà phê” trả đúng một dòng và tổng chi 20.000đ. Tải lại vẫn giữ phiên và dữ liệu.
- Sau thao tác UI, ví tiền mặt **780.000đ**, ví ngân hàng **9.180.000đ**, tổng **9.960.000đ**; cả hai đối soát **chênh lệch 0đ**. Tổng chi tháng **1.040.000đ**; chuyển tiền và số dư ban đầu được loại khỏi thu/chi.
- Viewport 390×844: tổng quan, bộ lọc/lịch sử và hộp thoại vừa trang; bảng dài cuộn bên trong. Hộp thoại cuộn dọc để truy cập nút lưu. Không có lỗi console ở phiên kiểm tra cuối.
- OpenAPI có **17 đường dẫn, 27 schema**, mọi tham chiếu schema đều tồn tại.
- Tài khoản QA đã được vô hiệu hóa; trang web để ở đăng ký cho người dùng. Các ảnh chỉ minh họa kết quả thử nghiệm.
- GitHub CI/remote, Docker thực tế và HTTPS/domain chưa được kiểm tra hoặc triển khai.

## 5. Quyết định/giả định

Chi tiết ở `docs/DECISIONS.md`. VND nguyên và giới hạn số an toàn; phép tính chính xác BigInt/Decimal128. Ví có lịch sử dùng lưu trữ; số dư ban đầu có dòng sổ bất biến. Transfer có cặp liên kết, không edit/clone lẻ. Mọi ghi tuần tự hóa theo tài khoản trong transaction; lịch sử đọc snapshot. Danh mục hệ thống bất biến. Ngày và tháng theo múi giờ hồ sơ. Đối soát sửa cần xác nhận riêng, nhân bản có ảnh hưởng số dư.

## 6. Tiếp theo

Giai đoạn 3: ngân sách theo danh mục, mục tiêu tiết kiệm, giao dịch định kỳ, báo cáo nâng cao và xuất CSV. Couple/tài chính chung/todo/fitness tiếp tục theo mục 17 của master prompt. Bản hiện tại hoàn thành đến giai đoạn 2, chưa phải toàn bộ website trong acceptance checklist.
