import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatMoney } from "../../lib/format";
import { useUiStore } from "../../app/store";
import { useInvalidateFinance } from "./api";
import { Category, Dialog, Reconcile, Wallet } from "./types";
export function DeleteDialog({
  dialog,
  categories,
  onClose,
}: {
  dialog: Extract<
    Dialog,
    { kind: "delete-wallet" | "delete-category" | "delete-entry" }
  >;
  categories: Category[];
  onClose: () => void;
}) {
  const [replacementId, setReplacementId] = useState("");
  const invalidate = useInvalidateFinance(),
    notify = useUiStore((s) => s.notify);
  const mutation = useMutation({
    mutationFn: () =>
      dialog.kind === "delete-wallet"
        ? apiClient.delete(`/wallets/${dialog.wallet.id}`)
        : dialog.kind === "delete-category"
          ? apiClient.delete(`/categories/${dialog.category.id}`, {
              data: replacementId ? { replacementId } : {},
            })
          : apiClient.delete(`/transactions/${dialog.entry.id}`),
    onSuccess: async () => {
      await invalidate();
      onClose();
      notify("Đã xóa và cập nhật dữ liệu.");
    },
  });
  return (
    <Modal title="Xác nhận xóa" onClose={onClose} busy={mutation.isPending}>
      <div className="settings-form finance-form">
        <p>
          {dialog.kind === "delete-wallet"
            ? `Xóa ví “${dialog.wallet.name}”? Ví đã có lịch sử cần được lưu trữ để giữ sổ giao dịch.`
            : dialog.kind === "delete-category"
              ? `Xóa danh mục “${dialog.category.name}”? Nếu có lịch sử, hãy chọn danh mục thay thế.`
              : dialog.entry.kind === "transfer"
                ? "Xóa cả hai dòng chuyển tiền liên kết và hoàn nguyên số dư hai ví?"
                : `Xóa “${dialog.entry.description}” và hoàn nguyên số dư ví?`}
        </p>
        {dialog.kind === "delete-category" && (
          <label>
            Danh mục thay thế
            <select
              value={replacementId}
              onChange={(e) => setReplacementId(e.target.value)}
            >
              <option value="">Không thay thế (khi chưa có lịch sử)</option>
              {categories
                .filter(
                  (c) =>
                    c.id !== dialog.category.id &&
                    c.type === dialog.category.type,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {mutation.error && (
          <p className="form-error" role="alert">
            {errorMessage(mutation.error)}
          </p>
        )}
        <div className="modal-actions">
          <Button
            className="button-outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Hủy
          </Button>
          <Button
            className="button-danger"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Đang xóa…" : "Xác nhận xóa"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export function ReconcileDialog({
  wallet,
  onClose,
}: {
  wallet: Wallet;
  onClose: () => void;
}) {
  const [result, setResult] = useState<Reconcile | null>(null),
    [confirm, setConfirm] = useState(false);
  const invalidate = useInvalidateFinance();
  const mutation = useMutation({
    mutationFn: async (repair: boolean) =>
      (
        await apiClient.post<Reconcile>(`/wallets/${wallet.id}/reconcile`, {
          repair,
        })
      ).data,
    onSuccess: async (data) => {
      setResult(data);
      setConfirm(false);
      if (data.repaired) await invalidate();
    },
  });
  return (
    <Modal
      title={`Đối soát · ${wallet.name}`}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <div className="settings-form finance-form">
        <p>
          So sánh số dư ví với toàn bộ sổ giao dịch, gồm số dư ban đầu và các
          khoản chuyển tiền.
        </p>
        {result && (
          <div className="reconcile-result">
            <p>
              Số dư đã ghi: <b>{formatMoney(result.actualBalance)}</b>
            </p>
            <p>
              Số dư theo sổ: <b>{formatMoney(result.expectedBalance)}</b>
            </p>
            <p role="status">
              {result.repaired
                ? "Đã sửa số dư theo sổ."
                : result.matched
                  ? "Số dư khớp với sổ giao dịch."
                  : `Chênh lệch: ${formatMoney(result.difference)}`}
            </p>
          </div>
        )}
        {confirm && (
          <p role="alert">
            Bạn xác nhận thay số dư ví bằng{" "}
            {formatMoney(result!.expectedBalance)} theo sổ giao dịch?
          </p>
        )}
        {mutation.error && (
          <p className="form-error" role="alert">
            {errorMessage(mutation.error)}
          </p>
        )}
        <div className="modal-actions">
          <Button
            className="button-outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Đóng
          </Button>
          {result &&
            !result.matched &&
            !result.repaired &&
            (confirm ? (
              <Button
                className="button-danger"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate(true)}
              >
                Xác nhận sửa số dư
              </Button>
            ) : (
              <Button
                className="button-outline"
                onClick={() => setConfirm(true)}
              >
                Sửa theo sổ
              </Button>
            ))}
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(false)}
          >
            {mutation.isPending ? "Đang kiểm tra…" : "Kiểm tra số dư"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
