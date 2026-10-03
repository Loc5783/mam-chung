import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui";
import { useAuthStore } from "../auth/store";
import { localInputDate } from "../finance/api";
import { Category } from "../finance/types";
import { SharedWallet, SharedGoal, Member, Settlement } from "./types";
import { useSharedMutation } from "./api";
export type Dialog =
  | { kind: "wallet"; wallet?: SharedWallet }
  | { kind: "deposit"; wallet: SharedWallet }
  | { kind: "expense" }
  | { kind: "goal"; goal?: SharedGoal }
  | { kind: "goal-deposit"; goal: SharedGoal }
  | {
      kind: "action";
      path: string;
      method: "put" | "delete";
      title: string;
      message: string;
      settlement?: Settlement;
    };
const money = z
  .number()
  .int()
  .positive("Số tiền phải lớn hơn 0.")
  .max(Number.MAX_SAFE_INTEGER, "Số tiền vượt giới hạn an toàn.");
export function SharedForm({
  dialog,
  wallets,
  members,
  categories,
  onClose,
}: {
  dialog: Dialog;
  wallets: SharedWallet[];
  members: Member[];
  categories: Category[];
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const name =
    dialog.kind === "wallet"
      ? dialog.wallet?.name
      : dialog.kind === "goal"
        ? dialog.goal?.name
        : "";
  const validate = z
    .object({
      name: z.string(),
      amount: z.number({ invalid_type_error: "Vui lòng nhập số hợp lệ." }),
      date: z.string(),
      deadline: z.string(),
      notes: z.string().max(1000),
      sharedWalletId: z.string(),
      payerId: z.string(),
      categoryId: z.string(),
      description: z.string(),
      splitType: z.enum(["equal", "custom", "percent"]),
      paidFrom: z.enum(["fund", "personal"]),
      share0: z.number({ invalid_type_error: "Vui lòng nhập số hợp lệ." }),
      share1: z.number({ invalid_type_error: "Vui lòng nhập số hợp lệ." }),
      confirm: z.boolean(),
    })
    .superRefine((v, c) => {
      const issue = (path: string, message: string) =>
        c.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      if (
        ["wallet", "goal"].includes(dialog.kind) &&
        (!v.name.trim() || v.name.trim().length > 100)
      )
        issue("name", "Tên cần 1–100 ký tự.");
      if (
        !["wallet", "action"].includes(dialog.kind) &&
        !money.safeParse(v.amount).success
      )
        issue(
          "amount",
          "Số tiền cần là số nguyên dương trong giới hạn an toàn.",
        );
      if (
        ["deposit", "expense", "goal-deposit"].includes(dialog.kind) &&
        !/^\d{4}-\d{2}-\d{2}$/.test(v.date)
      )
        issue("date", "Vui lòng chọn ngày.");
      if (dialog.kind === "action" && !v.confirm)
        issue("confirm", "Vui lòng xác nhận trước khi tiếp tục.");
      if (dialog.kind === "expense") {
        if (!v.sharedWalletId) issue("sharedWalletId", "Vui lòng chọn quỹ.");
        if (!v.payerId) issue("payerId", "Vui lòng chọn người trả.");
        if (!v.categoryId) issue("categoryId", "Vui lòng chọn danh mục chi.");
        if (!v.description.trim() || v.description.trim().length > 200)
          issue("description", "Mô tả cần 1–200 ký tự.");
        if (v.splitType !== "equal") {
          if (
            v.splitType === "custom" &&
            (!Number.isSafeInteger(v.share0) ||
              !Number.isSafeInteger(v.share1) ||
              v.share0 < 0 ||
              v.share1 < 0 ||
              !Number.isSafeInteger(v.amount) ||
              BigInt(v.share0) + BigInt(v.share1) !== BigInt(v.amount))
          )
            issue(
              "share1",
              "Tổng hai phần chia phải bằng số tiền, không lệch một đồng.",
            );
          if (
            v.splitType === "percent" &&
            ([v.share0, v.share1].some(
              (p) =>
                !Number.isFinite(p) ||
                p < 0 ||
                p > 100 ||
                !/^\d+(\.\d{1,2})?$/.test(String(p)),
            ) ||
              Math.round(v.share0 * 100) + Math.round(v.share1 * 100) !== 10000)
          )
            issue(
              "share1",
              "Tổng tỷ lệ phải bằng 100%, tối đa 2 chữ số thập phân.",
            );
        }
      }
    });
  type Values = z.infer<typeof validate>;
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(validate),
    defaultValues: {
      name: name ?? "",
      amount: dialog.kind === "goal" ? (dialog.goal?.targetAmount ?? 0) : 0,
      date: localInputDate(new Date(), user.timezone),
      deadline: dialog.kind === "goal" ? (dialog.goal?.deadline ?? "") : "",
      notes: dialog.kind === "goal" ? (dialog.goal?.notes ?? "") : "",
      sharedWalletId: wallets.find((w) => !w.archived)?.id ?? "",
      payerId: user.id,
      categoryId: categories[0]?.id ?? "",
      description: "",
      splitType: "equal",
      paidFrom: "personal",
      share0: 50,
      share1: 50,
      confirm: false,
    },
  });
  const title =
    dialog.kind === "wallet"
      ? dialog.wallet
        ? "Sửa quỹ chung"
        : "Tạo quỹ chung"
      : dialog.kind === "deposit"
        ? `Nạp vào ${dialog.wallet.name}`
        : dialog.kind === "expense"
          ? "Ghi khoản chi chung"
          : dialog.kind === "goal"
            ? dialog.goal
              ? "Sửa mục tiêu chung"
              : "Tạo mục tiêu chung"
            : dialog.kind === "goal-deposit"
              ? `Dành dụm cho ${dialog.goal.name}`
              : dialog.title;
  const mutation = useSharedMutation(
    async (raw) => {
      const v = raw as Values;
      if (dialog.kind === "action")
        return dialog.method === "delete"
          ? apiClient.delete(dialog.path)
          : apiClient.put(dialog.path, { notes: v.notes });
      if (dialog.kind === "wallet")
        return dialog.wallet
          ? apiClient.put("/shared-wallets/" + dialog.wallet.id, {
              name: v.name.trim(),
            })
          : apiClient.post("/shared-wallets", { name: v.name.trim() });
      if (dialog.kind === "deposit")
        return apiClient.post(
          `/shared-wallets/${dialog.wallet.id}/contribute`,
          { amount: v.amount, date: v.date, notes: v.notes },
        );
      if (dialog.kind === "goal")
        return dialog.goal
          ? apiClient.put("/shared-goals/" + dialog.goal.id, {
              name: v.name.trim(),
              targetAmount: v.amount,
              deadline: v.deadline || null,
              notes: v.notes,
            })
          : apiClient.post("/shared-goals", {
              name: v.name.trim(),
              targetAmount: v.amount,
              deadline: v.deadline || null,
              notes: v.notes,
            });
      if (dialog.kind === "goal-deposit")
        return apiClient.post(`/shared-goals/${dialog.goal.id}/contribute`, {
          amount: v.amount,
          date: v.date,
          notes: v.notes,
        });
      const body = {
        sharedWalletId: v.sharedWalletId,
        payerId: v.payerId,
        categoryId: v.categoryId,
        amount: v.amount,
        date: v.date,
        description: v.description.trim(),
        splitType: v.splitType,
        paidFrom: v.paidFrom,
        ...(v.splitType !== "equal"
          ? {
              splits: members.map((m, i) => ({
                userId: m.id,
                ...(v.splitType === "custom"
                  ? { shareAmount: i ? v.share1 : v.share0 }
                  : { percent: i ? v.share1 : v.share0 }),
              })),
            }
          : {}),
      };
      return apiClient.post("/shared-transactions", body);
    },
    onClose,
    dialog.kind === "action"
      ? "Đã cập nhật sổ chung."
      : "Đã lưu vào không gian chung.",
  );
  const error = (key: keyof Values) =>
    errors[key]?.message ? (
      <span className="field-error" role="alert">
        {errors[key]?.message}
      </span>
    ) : null;
  const split = watch("splitType"),
    amount = watch("amount");
  return (
    <Modal title={title} onClose={onClose} busy={mutation.isPending}>
      <form
        className="settings-form finance-form"
        noValidate
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
      >
        {dialog.kind === "action" ? (
          <>
            <p>{dialog.message}</p>
            {dialog.settlement && (
              <p>
                <b>
                  {dialog.settlement.fromName} → {dialog.settlement.toName}:{" "}
                  {dialog.settlement.amount.toLocaleString("vi-VN")} đ
                </b>
              </p>
            )}
            <label>
              Ghi chú
              <textarea {...register("notes")} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" {...register("confirm")} />
              Tôi xác nhận nội dung trên
            </label>
            {error("confirm")}
          </>
        ) : (
          <>
            {["wallet", "goal"].includes(dialog.kind) && (
              <label>
                Tên
                <input aria-label="Tên" {...register("name")} maxLength={100} />
                {error("name")}
              </label>
            )}
            {dialog.kind !== "wallet" && (
              <label>
                {dialog.kind === "goal" ? "Mục tiêu (đ)" : "Số tiền (đ)"}
                <input
                  type="number"
                  min="1"
                  step="1"
                  {...register("amount", { valueAsNumber: true })}
                />
                {error("amount")}
              </label>
            )}
            {dialog.kind === "expense" && (
              <>
                <label>
                  Quỹ
                  <select {...register("sharedWalletId")}>
                    <option value="">Chọn quỹ</option>
                    {wallets
                      .filter((w) => !w.archived)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                  {error("sharedWalletId")}
                </label>
                <label>
                  Người trả
                  <select {...register("payerId")}>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {error("payerId")}
                </label>
                <label>
                  Nguồn tiền
                  <select {...register("paidFrom")}>
                    <option value="personal">
                      Ứng tiền cá nhân — phát sinh công nợ
                    </option>
                    <option value="fund">
                      Chi từ quỹ — không phát sinh công nợ
                    </option>
                  </select>
                </label>
                <label>
                  Danh mục chi
                  <select {...register("categoryId")}>
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {error("categoryId")}
                </label>
                <label>
                  Mô tả
                  <input {...register("description")} maxLength={200} />
                  {error("description")}
                </label>
                <label>
                  Cách chia
                  <select {...register("splitType")}>
                    <option value="equal">Chia đều</option>
                    <option value="custom">Theo số tiền</option>
                    <option value="percent">Theo phần trăm</option>
                  </select>
                </label>
                {split === "equal" ? (
                  <p className="settings-description">
                    Mỗi người chịu một nửa phần chi; số đồng lẻ thuộc người trả.
                    {Number.isSafeInteger(amount) && amount > 0
                      ? ` Tổng ${amount.toLocaleString("vi-VN")} đ.`
                      : ""}
                  </p>
                ) : (
                  members.map((m, i) => (
                    <label key={m.id}>
                      {m.name} ({split === "percent" ? "%" : "đ"})
                      <input
                        type="number"
                        min="0"
                        step={split === "percent" ? "0.01" : "1"}
                        aria-label={`${m.name} (${split === "percent" ? "%" : "đ"})`}
                        {...register(i ? "share1" : "share0", {
                          valueAsNumber: true,
                        })}
                      />
                      {error(i ? "share1" : "share0")}
                    </label>
                  ))
                )}
              </>
            )}
            {["deposit", "expense", "goal-deposit"].includes(dialog.kind) && (
              <label>
                Ngày
                <input type="date" {...register("date")} />
                {error("date")}
              </label>
            )}
            {dialog.kind === "goal" && (
              <label>
                Hạn mục tiêu (không bắt buộc)
                <input type="date" {...register("deadline")} />
              </label>
            )}
            {["deposit", "goal", "goal-deposit"].includes(dialog.kind) && (
              <label>
                Ghi chú
                <textarea {...register("notes")} />
                {error("notes")}
              </label>
            )}
            {dialog.kind === "deposit" && (
              <p className="settings-description">
                Ghi nhận tiền đã nạp vào quỹ. Ứng dụng không chuyển tiền ngân
                hàng và không tự trừ ví cá nhân.
              </p>
            )}
            {dialog.kind === "goal-deposit" && (
              <p className="settings-description">
                Ghi nhận tiền đã dành riêng cho mục tiêu; không trừ quỹ hoặc ví
                và không tính là khoản chi.
              </p>
            )}
          </>
        )}
        {mutation.error && (
          <p className="form-error" role="alert">
            {errorMessage(mutation.error)}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            className="button-outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "Đang lưu…"
              : dialog.kind === "action"
                ? "Xác nhận"
                : "Lưu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
