import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatMoney } from "../../lib/format";
import { useUiStore } from "../../app/store";
import { useAuthStore } from "../auth/store";
import { Wallet, Category, Entry } from "./types";
import { localInputDate, useInvalidateFinance } from "./api";
export const iconOptions = [
  ["Wallet", "Ví"],
  ["Landmark", "Ngân hàng"],
  ["Smartphone", "Điện thoại"],
  ["Utensils", "Ăn uống"],
  ["Car", "Di chuyển"],
  ["ShoppingBag", "Mua sắm"],
  ["Receipt", "Hóa đơn"],
  ["Gamepad2", "Giải trí"],
  ["HeartPulse", "Sức khỏe"],
  ["GraduationCap", "Giáo dục"],
  ["Briefcase", "Công việc"],
  ["Gift", "Quà tặng"],
  ["Ellipsis", "Khác"],
  ["PiggyBank", "Tiết kiệm"],
  ["House", "Nhà ở"],
  ["Coffee", "Cà phê"],
] as const;
const amountSchema = z
  .number({ invalid_type_error: "Vui lòng nhập số tiền." })
  .int("Số tiền phải là số nguyên VND.")
  .positive("Số tiền phải lớn hơn 0.")
  .max(Number.MAX_SAFE_INTEGER, "Số tiền vượt giới hạn an toàn.");
const walletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên ví.")
    .max(80, "Tên ví tối đa 80 ký tự."),
  type: z.enum(["cash", "bank", "ewallet"]),
  initialBalance: z
    .number({ invalid_type_error: "Vui lòng nhập số dư ban đầu." })
    .int("Số dư phải là số nguyên VND.")
    .min(0, "Số dư ban đầu không được âm.")
    .max(Number.MAX_SAFE_INTEGER, "Số dư vượt giới hạn an toàn."),
  allowNegative: z.boolean(),
  color: z.string(),
  icon: z.string(),
});
type WalletValues = z.infer<typeof walletSchema>;
const entrySchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: amountSchema,
  walletId: z.string().min(1, "Vui lòng chọn ví."),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vui lòng chọn ngày."),
  description: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mô tả.")
    .max(200, "Mô tả tối đa 200 ký tự."),
  notes: z.string().max(1000, "Ghi chú tối đa 1000 ký tự."),
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
});
type EntryValues = z.infer<typeof entrySchema>;
const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập tên danh mục.")
    .max(60, "Tên danh mục tối đa 60 ký tự."),
  type: z.enum(["income", "expense"]),
  icon: z.string(),
});
type CategoryValues = z.infer<typeof categorySchema>;
const transferSchema = z
  .object({
    fromWalletId: z.string().min(1, "Vui lòng chọn ví gửi."),
    toWalletId: z.string().min(1, "Vui lòng chọn ví nhận."),
    amount: amountSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Vui lòng chọn ngày."),
    description: z.string().max(200, "Mô tả tối đa 200 ký tự."),
  })
  .refine((v) => v.fromWalletId !== v.toWalletId, {
    path: ["toWalletId"],
    message: "Ví nhận phải khác ví gửi.",
  });
type TransferValues = z.infer<typeof transferSchema>;
function FieldError({ message }: { message?: string }) {
  return message ? (
    <span role="alert" className="field-error">
      {message}
    </span>
  ) : null;
}
function ServerError({ error }: { error: unknown }) {
  return error ? (
    <div className="form-error" role="alert">
      {errorMessage(error)}
    </div>
  ) : null;
}
export function WalletForm({
  wallet,
  onClose,
}: {
  wallet?: Wallet;
  onClose: () => void;
}) {
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WalletValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: wallet?.name ?? "",
      type: wallet?.type ?? "cash",
      initialBalance: 0,
      allowNegative: wallet?.allowNegative ?? false,
      color: wallet?.color ?? "#7E9B57",
      icon: wallet?.icon ?? "Wallet",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: WalletValues) => {
      const { initialBalance, ...fields } = values;
      return wallet
        ? apiClient.put(`/wallets/${wallet.id}`, fields)
        : apiClient.post("/wallets", { ...fields, initialBalance });
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
      notify(wallet ? "Đã cập nhật ví." : "Đã tạo ví mới.");
    },
  });
  return (
    <Modal
      title={wallet ? "Chăm chút chiếc ví" : "Tạo một chiếc ví"}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="settings-form finance-form"
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <label>
          Tên ví
          <input
            {...register("name")}
            placeholder="Ví dụ: Tiền mặt, Tài khoản lương"
            disabled={mutation.isPending}
          />
          <FieldError message={errors.name?.message} />
        </label>
        <div className="form-two-columns">
          <label>
            Loại ví
            <select {...register("type")}>
              <option value="cash">Tiền mặt</option>
              <option value="bank">Ngân hàng</option>
              <option value="ewallet">Ví điện tử</option>
            </select>
          </label>
          <label>
            Biểu tượng
            <select {...register("icon")}>
              {iconOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!wallet && (
          <label>
            Số dư ban đầu (đ)
            <input
              type="number"
              min="0"
              step="1"
              {...register("initialBalance", { valueAsNumber: true })}
            />
            <FieldError message={errors.initialBalance?.message} />
            <small>Số dư này được ghi vào sổ, không tính là thu nhập.</small>
          </label>
        )}
        <label>
          Màu ví
          <select {...register("color")}>
            <option value="#7E9B57">Xanh cốm</option>
            <option value="#57713A">Xanh lá đậm</option>
            <option value="#B9CC9A">Xanh lá nhạt</option>
            <option value="#E38FA9">Hồng</option>
            <option value="#B3577A">Hồng đậm</option>
          </select>
        </label>
        <label className="checkbox-field">
          <input type="checkbox" {...register("allowNegative")} />
          Cho phép số dư âm
        </label>
        <small className="form-help">
          Mặc định, Mầm Chung sẽ chặn khoản chi vượt số dư ví.
        </small>
        <ServerError error={mutation.error} />
        <div className="modal-actions">
          <Button
            type="button"
            className="button-outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Đang lưu…"
              : wallet
                ? "Lưu thay đổi"
                : "Tạo ví"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function TransactionForm({
  entry,
  wallets,
  categories,
  onClose,
}: {
  entry?: Entry;
  wallets: Wallet[];
  categories: Category[];
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user)!,
    invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const activeWallets = wallets.filter((w) => !w.archived);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EntryValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      type: entry?.type ?? "expense",
      amount: entry?.amount,
      walletId: entry?.walletId ?? activeWallets[0]?.id ?? "",
      categoryId: entry?.categoryId ?? "",
      date: localInputDate(entry?.date ?? new Date(), user.timezone),
      description: entry?.description ?? "",
      notes: entry?.notes ?? "",
      tags: entry?.tags.join(", ") ?? "",
    },
  });
  const type = watch("type"),
    selectedWallet = wallets.find((w) => w.id === watch("walletId"));
  const mutation = useMutation({
    mutationFn: (values: EntryValues) => {
      const data = {
        ...values,
        tags: [
          ...new Set(
            values.tags
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          ),
        ],
      };
      return entry
        ? apiClient.put(`/transactions/${entry.id}`, data)
        : apiClient.post("/transactions", data);
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
      notify(
        entry ? "Đã cập nhật giao dịch và số dư ví." : "Đã ghi giao dịch.",
      );
    },
  });
  return (
    <Modal
      title={entry ? "Sửa giao dịch" : "Ghi lại một giao dịch"}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="settings-form finance-form"
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <div className="form-two-columns">
          <label>
            Loại giao dịch
            <select
              {...register("type")}
              onChange={(event) => {
                setValue("type", event.target.value as "income" | "expense");
                setValue("categoryId", "");
              }}
            >
              <option value="expense">Khoản chi</option>
              <option value="income">Khoản thu</option>
            </select>
          </label>
          <label>
            Số tiền (đ)
            <input
              type="number"
              min="1"
              step="1"
              placeholder="0"
              {...register("amount", { valueAsNumber: true })}
            />
            <FieldError message={errors.amount?.message} />
          </label>
        </div>
        <label>
          Ví sử dụng
          <select {...register("walletId")}>
            <option value="">Chọn ví</option>
            {activeWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {formatMoney(w.balance)}
              </option>
            ))}
          </select>
          <FieldError message={errors.walletId?.message} />
          {selectedWallet && (
            <small>
              Số dư: {formatMoney(selectedWallet.balance)}
              {selectedWallet.allowNegative ? " · Có thể âm" : ""}
            </small>
          )}
        </label>
        <div className="form-two-columns">
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
            <FieldError message={errors.categoryId?.message} />
          </label>
          <label>
            Ngày giao dịch
            <input type="date" {...register("date")} />
            <FieldError message={errors.date?.message} />
          </label>
        </div>
        <label>
          Mô tả
          <input
            {...register("description")}
            placeholder={
              type === "expense"
                ? "Ví dụ: Bữa trưa hôm nay"
                : "Ví dụ: Lương tháng này"
            }
          />
          <FieldError message={errors.description?.message} />
        </label>
        <label>
          Ghi chú (tùy chọn)
          <textarea rows={2} {...register("notes")} />
          <FieldError message={errors.notes?.message} />
        </label>
        <label>
          Nhãn (phân cách bằng dấu phẩy)
          <input
            {...register("tags")}
            placeholder="Ví dụ: công việc, cuối tuần"
          />
          <FieldError message={errors.tags?.message} />
        </label>
        <ServerError error={mutation.error} />
        <div className="modal-actions">
          <Button
            type="button"
            className="button-outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Đang ghi…"
              : entry
                ? "Lưu thay đổi"
                : "Lưu giao dịch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function CategoryForm({
  category,
  onClose,
}: {
  category?: Category;
  onClose: () => void;
}) {
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      type: category?.type ?? "expense",
      icon: category?.icon ?? "Ellipsis",
    },
  });
  const mutation = useMutation({
    mutationFn: (values: CategoryValues) =>
      category
        ? apiClient.put(`/categories/${category.id}`, values)
        : apiClient.post("/categories", values),
    onSuccess: async () => {
      await invalidate();
      onClose();
      notify("Đã lưu danh mục.");
    },
  });
  return (
    <Modal
      title={category ? "Sửa danh mục" : "Tạo danh mục riêng"}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="settings-form finance-form"
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <label>
          Tên danh mục
          <input {...register("name")} placeholder="Ví dụ: Cà phê, Thú cưng" />
          <FieldError message={errors.name?.message} />
        </label>
        <label>
          Loại
          <select {...register("type")}>
            <option value="expense">Khoản chi</option>
            <option value="income">Khoản thu</option>
          </select>
          <small>Danh mục đã có lịch sử không thể đổi loại.</small>
        </label>
        <label>
          Biểu tượng
          <select {...register("icon")}>
            {iconOptions.map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <ServerError error={mutation.error} />
        <div className="modal-actions">
          <Button
            type="button"
            className="button-outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Đang lưu…" : "Lưu danh mục"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function TransferForm({
  wallets,
  onClose,
}: {
  wallets: Wallet[];
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user)!,
    invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const active = wallets.filter((w) => !w.archived);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromWalletId: active[0]?.id ?? "",
      toWalletId: active[1]?.id ?? "",
      date: localInputDate(new Date(), user.timezone),
      description: "Chuyển tiền giữa ví",
    },
  });
  const from = wallets.find((w) => w.id === watch("fromWalletId"));
  const mutation = useMutation({
    mutationFn: (values: TransferValues) =>
      apiClient.post("/wallets/transfer", values),
    onSuccess: async () => {
      await invalidate();
      onClose();
      notify("Đã chuyển tiền giữa hai ví.");
    },
  });
  return (
    <Modal
      title="Chuyển tiền giữa ví"
      onClose={onClose}
      busy={mutation.isPending}
    >
      <p className="settings-description">
        Ghi nhận tiền chuyển giữa hai ví của bạn. Khoản này không tính vào thu
        nhập hoặc chi tiêu.
      </p>
      <form
        className="settings-form finance-form"
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <label>
          Từ ví
          <select {...register("fromWalletId")}>
            <option value="">Chọn ví gửi</option>
            {active.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {formatMoney(w.balance)}
              </option>
            ))}
          </select>
          <FieldError message={errors.fromWalletId?.message} />
          {from && <small>Số dư: {formatMoney(from.balance)}</small>}
        </label>
        <label>
          Đến ví
          <select {...register("toWalletId")}>
            <option value="">Chọn ví nhận</option>
            {active.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.toWalletId?.message} />
        </label>
        <div className="form-two-columns">
          <label>
            Số tiền chuyển (đ)
            <input
              type="number"
              min="1"
              step="1"
              {...register("amount", { valueAsNumber: true })}
            />
            <FieldError message={errors.amount?.message} />
          </label>
          <label>
            Ngày chuyển
            <input type="date" {...register("date")} />
            <FieldError message={errors.date?.message} />
          </label>
        </div>
        <label>
          Mô tả
          <input {...register("description")} />
          <FieldError message={errors.description?.message} />
        </label>
        <ServerError error={mutation.error} />
        <div className="modal-actions">
          <Button
            type="button"
            className="button-outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Đang chuyển…" : "Ghi chuyển tiền"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
