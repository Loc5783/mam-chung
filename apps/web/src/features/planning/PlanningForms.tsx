import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { useInvalidateFinance, localInputDate } from "../finance/api";
import { useUiStore } from "../../app/store";
import { useAuthStore } from "../auth/store";
import { Wallet, Category } from "../finance/types";
import { Budget, Goal, Recurring } from "./types";
import { useCurrentMonth } from "./api";
const amount = z
  .number({ invalid_type_error: "Vui lòng nhập số tiền." })
  .int("Số tiền phải là số nguyên VND.")
  .positive("Số tiền phải lớn hơn 0.")
  .max(Number.MAX_SAFE_INTEGER, "Số tiền vượt giới hạn an toàn.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vui lòng chọn ngày.");
const budgetSchema = z.object({
  categoryId: z.string().min(1, "Vui lòng chọn danh mục."),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Vui lòng chọn tháng."),
  amount,
});
const goalSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên mục tiêu.").max(100),
  targetAmount: amount,
  deadline: z.string(),
  notes: z.string().max(1000),
  color: z.string(),
});
const contributeSchema = z.object({
  amount,
  date,
  notes: z.string().max(1000),
});
const recurringSchema = z
  .object({
    type: z.enum(["income", "expense"]),
    amount,
    walletId: z.string().min(1, "Vui lòng chọn ví."),
    categoryId: z.string().min(1, "Vui lòng chọn danh mục."),
    description: z.string().trim().min(1, "Vui lòng nhập mô tả.").max(200),
    notes: z.string().max(1000),
    tags: z
      .string()
      .refine(
        (v) =>
          v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean).length <= 10,
        "Tối đa 10 nhãn.",
      )
      .refine(
        (v) => v.split(",").every((s) => s.trim().length <= 30),
        "Mỗi nhãn tối đa 30 ký tự.",
      ),
    frequency: z.enum(["weekly", "monthly"]),
    nextDate: date,
    endDate: z.string(),
    enabled: z.boolean(),
  })
  .refine((v) => !v.enabled || !v.endDate || v.nextDate <= v.endDate, {
    path: ["endDate"],
    message: "Ngày kết thúc phải sau hoặc bằng kỳ tiếp theo.",
  });
function ErrorText({ message }: { message?: string }) {
  return message ? (
    <span className="field-error" role="alert">
      {message}
    </span>
  ) : null;
}
function ServerError({ error }: { error: unknown }) {
  return error ? (
    <p className="form-error" role="alert">
      {errorMessage(error)}
    </p>
  ) : null;
}
function Actions({
  busy,
  onClose,
  label = "Lưu",
}: {
  busy: boolean;
  onClose: () => void;
  label?: string;
}) {
  return (
    <div className="modal-actions">
      <Button
        type="button"
        className="button-outline"
        onClick={onClose}
        disabled={busy}
      >
        Hủy
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? "Đang lưu…" : label}
      </Button>
    </div>
  );
}
function useSave(
  path: string,
  editing: boolean,
  onClose: () => void,
  message: string,
) {
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  return useMutation({
    mutationFn: (data: unknown) =>
      editing ? apiClient.put(path, data) : apiClient.post(path, data),
    onSuccess: async () => {
      await invalidate();
      onClose();
      notify(message);
    },
  });
}
export function BudgetForm({
  budget,
  categories,
  onClose,
}: {
  budget?: Budget;
  categories: Category[];
  onClose: () => void;
}) {
  const month = useCurrentMonth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      categoryId: budget?.categoryId ?? "",
      month: budget?.month ?? month,
      amount: budget?.amount,
    },
  });
  const mutation = useSave(
    budget ? `/budgets/${budget.id}` : "/budgets",
    !!budget,
    onClose,
    "Đã lưu ngân sách.",
  );
  return (
    <Modal
      title={budget ? "Sửa ngân sách" : "Đặt ngân sách tháng"}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="settings-form finance-form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
      >
        <label>
          Danh mục chi
          <select {...register("categoryId")}>
            <option value="">Chọn danh mục</option>
            {categories
              .filter((c) => c.type === "expense")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <ErrorText message={errors.categoryId?.message} />
        </label>
        <label>
          Tháng ngân sách
          <input type="month" {...register("month")} />
          <ErrorText message={errors.month?.message} />
        </label>
        <label>
          Giới hạn chi (đ)
          <input
            type="number"
            min="1"
            step="1"
            {...register("amount", { valueAsNumber: true })}
          />
          <ErrorText message={errors.amount?.message} />
        </label>
        <p className="form-help">
          Mầm Chung nhắc bạn ở mức 80% và 100%. Ngân sách giúp theo dõi, không
          chặn giao dịch.
        </p>
        <ServerError error={mutation.error} />
        <Actions
          onClose={onClose}
          busy={mutation.isPending}
          label="Lưu ngân sách"
        />
      </form>
    </Modal>
  );
}
export function GoalForm({
  goal,
  onClose,
}: {
  goal?: Goal;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: goal?.name ?? "",
      targetAmount: goal?.targetAmount,
      deadline: goal?.deadline ?? "",
      notes: goal?.notes ?? "",
      color: goal?.color ?? "#7E9B57",
    },
  });
  const mutation = useSave(
    goal ? `/goals/${goal.id}` : "/goals",
    !!goal,
    onClose,
    "Đã lưu mục tiêu tiết kiệm.",
  );
  return (
    <Modal
      title={goal ? "Chăm chút mục tiêu" : "Gieo một mục tiêu"}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="settings-form finance-form"
        noValidate
        onSubmit={handleSubmit((v) =>
          mutation.mutate({ ...v, deadline: v.deadline || null }),
        )}
      >
        <label>
          Tên mục tiêu
          <input {...register("name")} placeholder="Ví dụ: Chuyến đi Đà Lạt" />
          <ErrorText message={errors.name?.message} />
        </label>
        <label>
          Số tiền mục tiêu (đ)
          <input
            type="number"
            min="1"
            step="1"
            {...register("targetAmount", { valueAsNumber: true })}
          />
          <ErrorText message={errors.targetAmount?.message} />
        </label>
        <label>
          Hạn hoàn thành (tùy chọn)
          <input type="date" {...register("deadline")} />
        </label>
        <label>
          Ghi chú
          <textarea rows={2} {...register("notes")} />
          <ErrorText message={errors.notes?.message} />
        </label>
        <label>
          Màu mục tiêu
          <select {...register("color")}>
            <option value="#7E9B57">Xanh cốm</option>
            <option value="#E38FA9">Hồng</option>
            <option value="#57713A">Xanh đậm</option>
            <option value="#B3577A">Hồng đậm</option>
          </select>
        </label>
        <ServerError error={mutation.error} />
        <Actions
          onClose={onClose}
          busy={mutation.isPending}
          label="Lưu mục tiêu"
        />
      </form>
    </Modal>
  );
}
export function ContributionForm({
  goal,
  onClose,
}: {
  goal: Goal;
  onClose: () => void;
}) {
  const zone = useAuthStore((s) => s.user!.timezone);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof contributeSchema>>({
    resolver: zodResolver(contributeSchema),
    defaultValues: { date: localInputDate(new Date(), zone), notes: "" },
  });
  const mutation = useSave(
    `/goals/${goal.id}/contribute`,
    false,
    onClose,
    "Đã ghi nhận tiền dành dụm.",
  );
  return (
    <Modal
      title={`Dành dụm cho ${goal.name}`}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <p className="settings-description">
        Ghi nhận số tiền bạn đã dành riêng cho mục tiêu. Thao tác này không trừ
        số dư ví và không tính là chi tiêu.
      </p>
      <form
        className="settings-form finance-form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
      >
        <label>
          Số tiền dành dụm (đ)
          <input
            type="number"
            min="1"
            step="1"
            {...register("amount", { valueAsNumber: true })}
          />
          <ErrorText message={errors.amount?.message} />
        </label>
        <label>
          Ngày ghi nhận
          <input type="date" {...register("date")} />
          <ErrorText message={errors.date?.message} />
        </label>
        <label>
          Ghi chú
          <textarea rows={2} {...register("notes")} />
        </label>
        <ServerError error={mutation.error} />
        <Actions
          onClose={onClose}
          busy={mutation.isPending}
          label="Ghi nhận dành dụm"
        />
      </form>
    </Modal>
  );
}
export function RecurringForm({
  recurring,
  wallets,
  categories,
  onClose,
}: {
  recurring?: Recurring;
  wallets: Wallet[];
  categories: Category[];
  onClose: () => void;
}) {
  const zone = useAuthStore((s) => s.user!.timezone);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof recurringSchema>>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      type: recurring?.type ?? "expense",
      amount: recurring?.amount,
      walletId:
        recurring?.walletId ?? wallets.find((w) => !w.archived)?.id ?? "",
      categoryId: recurring?.categoryId ?? "",
      description: recurring?.description ?? "",
      notes: recurring?.notes ?? "",
      tags: recurring?.tags.join(", ") ?? "",
      frequency: recurring?.frequency ?? "monthly",
      nextDate: recurring?.nextDate ?? localInputDate(new Date(), zone),
      endDate: recurring?.endDate ?? "",
      enabled: recurring?.enabled ?? true,
    },
  });
  const type = watch("type");
  const mutation = useSave(
    recurring ? `/recurring/${recurring.id}` : "/recurring",
    !!recurring,
    onClose,
    "Đã lưu lịch định kỳ.",
  );
  return (
    <Modal
      title={recurring ? "Sửa lịch định kỳ" : "Một khoản tiền đều đặn"}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="settings-form finance-form"
        noValidate
        onSubmit={handleSubmit((v) =>
          mutation.mutate({
            ...v,
            endDate: v.endDate || null,
            tags: [
              ...new Set(
                v.tags
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              ),
            ],
          }),
        )}
      >
        <div className="form-two-columns">
          <label>
            Loại giao dịch
            <select
              {...register("type")}
              onChange={(e) => {
                setValue("type", e.target.value as "income" | "expense");
                setValue("categoryId", "");
              }}
            >
              <option value="expense">Khoản chi</option>
              <option value="income">Khoản thu</option>
            </select>
          </label>
          <label>
            Số tiền mỗi kỳ (đ)
            <input
              type="number"
              min="1"
              step="1"
              {...register("amount", { valueAsNumber: true })}
            />
            <ErrorText message={errors.amount?.message} />
          </label>
        </div>
        <label>
          Ví sử dụng
          <select {...register("walletId")}>
            <option value="">Chọn ví</option>
            {wallets
              .filter((w) => !w.archived || w.id === recurring?.walletId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.archived ? " (lưu trữ)" : ""}
                </option>
              ))}
          </select>
          <ErrorText message={errors.walletId?.message} />
        </label>
        <label>
          Danh mục
          <select {...register("categoryId")}>
            <option value="">Chọn danh mục</option>
            {categories
              .filter((c) => c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <ErrorText message={errors.categoryId?.message} />
        </label>
        <label>
          Mô tả
          <input
            {...register("description")}
            placeholder="Ví dụ: Tiền nhà hằng tháng"
          />
          <ErrorText message={errors.description?.message} />
        </label>
        <div className="form-two-columns">
          <label>
            Lặp lại
            <select {...register("frequency")}>
              <option value="monthly">Hằng tháng</option>
              <option value="weekly">Hằng tuần</option>
            </select>
          </label>
          <label>
            Kỳ tiếp theo
            <input type="date" {...register("nextDate")} />
            <ErrorText message={errors.nextDate?.message} />
          </label>
        </div>
        <label>
          Ngày kết thúc (tùy chọn)
          <input type="date" {...register("endDate")} />
          <ErrorText message={errors.endDate?.message} />
        </label>
        <label>
          Ghi chú
          <textarea rows={2} {...register("notes")} />
        </label>
        <label>
          Nhãn (phân cách bằng dấu phẩy)
          <input {...register("tags")} />
          <ErrorText message={errors.tags?.message} />
        </label>
        <label className="checkbox-field">
          <input type="checkbox" {...register("enabled")} />
          Bật ghi tự động
        </label>
        <p className="form-help">
          Kỳ đã đến hạn được ghi khi máy chủ chạy. Ngày quá khứ sẽ được chạy bù;
          mỗi kỳ chỉ ghi một lần. Không đủ tiền sẽ tạm giữ kỳ đó và báo lỗi.
        </p>
        <ServerError error={mutation.error} />
        <Actions
          onClose={onClose}
          busy={mutation.isPending}
          label="Lưu lịch định kỳ"
        />
      </form>
    </Modal>
  );
}
