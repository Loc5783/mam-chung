# Báo cáo giai đoạn 3 — Kế hoạch tài chính

## 1. Đã làm gì

- Ngân sách theo danh mục chi/tháng: tạo/sửa/xóa, tiến độ tính từ sổ thực, nhắc 80% và 100%, thẻ ngân sách trên tổng quan.
- Mục tiêu cá nhân: tên, số tiền, hạn, màu/ghi chú; dành dụm, lịch sử phân trang và hoàn tác. Số tiền cập nhật nguyên tử, không tự trừ ví.
- Mẫu giao dịch tuần/tháng: tạo/sửa, bật/tạm dừng, kết thúc; job tự chạy khi server mở, chạy bù, giữ kỳ lỗi để thử lại, chống ghi trùng. Có nút chạy kỳ đến hạn.
- Báo cáo 6/12 tháng: cột thu/chi, so sánh tháng trước, line xu hướng chi top 5, bảng tháng và tổng mọi danh mục.
- Xuất CSV theo bộ lọc lịch sử: UTF-8 BOM, tiếng Việt, quote/escape, bảo vệ trường văn bản trước công thức bảng tính, giới hạn 10.000 dòng.
- Giao diện Việt, loading/empty/error, modal xác nhận, desktop và điện thoại; giữ dữ liệu hiện hữu.

## 2. File mới/sửa

Mới:

- `apps/api/src/modules/planning/models.ts`, `schema.ts`, `repository.ts`, `service.ts`, `controller.ts`, `routes.ts`, `job.ts`, `openapi.ts`, `tests/planning.test.ts`.
- `apps/web/src/features/planning/types.ts`, `api.ts`, `PlanningForms.tsx`, `PlanningPanel.tsx`, `PlanningReports.tsx`.
- `apps/web/src/test/planning.test.tsx`, `docs/PHASE_3.md`.

Sửa:

- API `src/app.ts`, `config/db.ts`, `config/openapi.ts`, `server.ts`, `modules/finance/service.ts`, `modules/finance/openapi.ts`.
- Web `features/finance/FinancePage.tsx`, `FinanceOverview.tsx`, `features/settings/SettingsPage.tsx`, `styles/global.css`.
- `README.md`, `docs/API.md`, `docs/DECISIONS.md`.

Ảnh thử nghiệm riêng trong outputs: `mam-chung-phase-3.jpg` (báo cáo 12 tháng), `mam-chung-planning-mobile.jpg` (ngân sách điện thoại). Số liệu là giả lập trên tài khoản QA đã vô hiệu hóa sau kiểm tra.

## 3. Cách chạy và kiểm tra

Mở thư mục `outputs/mam-chung`, Node.js ≥20:

```powershell
npm ci
npm run dev:local
```

Web: http://127.0.0.1:5173/login. Tài chính: http://127.0.0.1:5173/finance. Chọn tab Ngân sách/Mục tiêu/Định kỳ/Báo cáo; nút Xuất CSV ở Thu & chi. Swagger: http://127.0.0.1:4000/api/docs.

```powershell
npm run lint
npm test
npm run build
npm run format:check
```

Local runner dùng MongoDB replica set riêng, giữ `.local/data`; secret bị loại khỏi Git. Kiểm thử dùng DB riêng và không xóa dữ liệu local. Dừng runner cũ trước khi chạy bản mới; sửa backend cần khởi động lại. Có thể tái dùng binary qua `MONGOMS_DOWNLOAD_DIR`. Docker chưa chạy thực tế vì máy chưa cài Docker.

## 4. Kết quả kiểm tra

- Backend **97/97 đạt**: 29 kiểm tra mới, 68 kiểm tra trước. Bao gồm ngân sách thực/80%/100%/số lớn/ghi đồng thời, mục tiêu và hoàn tác nguyên tử, rollback, quyền sở hữu, định kỳ cuối tháng/leap/week/timezone/catch-up/100 kỳ/endDate/thiếu tiền/job/chống trùng, reports và CSV/escape/injection/giới hạn.
- Frontend **49/49 đạt**: 14 kiểm tra mới, 35 kiểm tra trước. Kiểm tra form/validation, ngân sách/tháng, dành dụm/lịch sử/xác nhận, định kỳ/tạm dừng/chạy, báo cáo 6/12 tháng, CSV theo bộ lọc và lỗi máy chủ.
- Coverage planning service: **100% statements, 90,58% branches, 100% functions, 100% lines**. Tổng service: **99,01% statements, 91,76% branches, 100% functions, 99,10% lines**, vượt yêu cầu 80%.
- TypeScript/lint, API/web build và format đạt. Vite còn cảnh báo bundle lớn; tối ưu tải ở giai đoạn hoàn thiện. Môi trường DOM giả lập không có kích thước biểu đồ nên có cảnh báo Recharts trong unit test; biểu đồ đã kiểm tra trên trình duyệt thực.
- Browser: ngân sách Ăn uống 800.000/1.000.000đ hiện 80%; sửa giới hạn 800.000đ hiện 100%. Ghi kỳ 50.000đ làm spent thành 850.000đ, UI hiện 106,3% và vượt 50.000đ. Dành dụm 500.000đ làm mục tiêu từ 1.500.000đ/30% lên 2.000.000đ/40%, không trừ ví.
- Chạy kỳ đến hạn ghi một dòng, nextDate chuyển 03/10 → 10/10; chạy lại không thêm dòng. Mẫu được tạm dừng sau kiểm tra.
- Báo cáo 6 và 12 tháng hiển thị đúng: tổng thu 10.000.000đ, tổng chi 1.450.000đ, tháng 10 thu 5.000.000đ/chi 850.000đ. Opening 10.000.000đ không tính thu.
- CSV tải về Downloads, đọc lại đủ header + 6 dòng, tên/mô tả tiếng Việt đúng; gồm opening và kỳ vừa ghi. API/unit tests kiểm tra bộ lọc và bảo vệ công thức. Browser công cụ không bắt được download event nhưng file tải thực tế đã được xác nhận.
- Đối soát sau thao tác: actual = expected = **18.550.000đ**, difference **0đ**. Goal savedAmount **2.000.000đ**, không tác động số dư.
- Viewport **390×844**: ngân sách vừa trang, tab cuộn ngang; form định kỳ cuộn dọc tới nút Hủy/Lưu. Không có lỗi console; có cảnh báo nâng cấp React Router của thư viện trong development.
- Tài khoản QA riêng đã vô hiệu hóa; tài khoản demo và dữ liệu hiện hữu được giữ. Browser trở lại đăng nhập.
- GitHub CI, Docker và HTTPS/domain chưa chạy/triển khai thực tế.

## 5. Quyết định/giả định

Chi tiết ở `docs/DECISIONS.md`: tiền nguyên VND; budget spent từ ledger và ngưỡng chính xác; mục tiêu là ghi nhận tiền để riêng; shared goal thuộc giai đoạn 4–5. Job kiểm tra mỗi phút nhưng chỉ ghi ngày/kỳ đến hạn theo timezone; startup/catch-up; khóa kỳ duy nhất và transaction chống trùng. Lỗi giữ nguyên kỳ để thử lại. Báo cáo không tính opening/transfer; CSV có các loại nếu bộ lọc cho phép và giới hạn 10.000 dòng. Khi server không chạy sẽ không tự ghi cho tới lần khởi động sau.

## 6. Tiếp theo

**Giai đoạn 4 — Couple:** tạo không gian chung, mã mời/chấp nhận/rời, ngày kỷ niệm và activity feed. Sau đó là tài chính chung, todo, fitness, dashboard/thông báo, hoàn thiện và triển khai theo master prompt. Giai đoạn 3 hoàn thành; toàn bộ acceptance checklist của website vẫn cần các giai đoạn sau.
