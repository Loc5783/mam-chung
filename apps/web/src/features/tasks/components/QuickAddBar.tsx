import { useState, useRef, useEffect } from "react";
import { Button } from "../../../components/ui";
import { Modal } from "../../../components/ui/Modal";
import { apiClient, errorMessage } from "../../../lib/apiClient";
import { useTaskMutation } from "../api";
import { parseQuickAdd, type QuickContext } from "../lib/parseQuickAdd";
export function QuickAddBar({
  context,
  disabled,
  onAdded,
  onBusy,
}: {
  context: QuickContext;
  disabled: boolean;
  onAdded?: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [text, setText] = useState(""),
    [omitted, setOmitted] = useState<string[]>([]),
    [literal, setLiteral] = useState(false),
    [confirm, setConfirm] = useState(false),
    [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lineMatches = [...text.matchAll(/[^\r\n]+/g)].filter((m) =>
    m[0].trim(),
  );
  const lines = lineMatches.map((m) => m[0]);
  const parsed = lines.map((line, index) =>
    parseQuickAdd(line, now, {
      ...context,
      omitted: omitted
        .filter((id) => id.startsWith(`${index}:`))
        .map((id) => id.slice(String(index).length + 1)),
    }),
  );
  const warnings = literal
    ? lines.flatMap((line) =>
        line.trim().length > 160 ? ["Tiêu đề tối đa 160 ký tự."] : [],
      )
    : parsed.flatMap((p) => p.warnings);
  const items = parsed.map((p, index) =>
    literal
      ? {
          title: lines[index].trim(),
          scope: context.scope ?? "personal",
          assignedTo: context.user.id,
          ...(context.listId ? { listId: context.listId } : {}),
          ...(context.deadline ? { deadline: context.deadline } : {}),
        }
      : { title: p.title, ...p.values },
  );
  const save = useTaskMutation(
    async () => {
      if (items.length === 1) return apiClient.post("/tasks", items[0]);
      return apiClient.post("/tasks/quick-add", { items });
    },
    () => {
      setText("");
      setOmitted([]);
      setConfirm(false);
      setLiteral(false);
      onAdded?.();
    },
  );
  useEffect(() => {
    onBusy?.(save.isPending);
  }, [onBusy, save.isPending]);
  const blocked =
    disabled ||
    save.isPending ||
    !lines.length ||
    lines.length > 50 ||
    warnings.length > 0;
  return (
    <div className="todo-quick-workspace">
      <form
        className="todo-quick-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) {
            if (lines.length > 1) setConfirm(true);
            else save.mutate();
          }
        }}
      >
        <textarea
          ref={inputRef}
          aria-label="Thêm nhanh công việc"
          placeholder="Đóng tiền nhà mai 9h !khẩn #hóa-đơn @tôi"
          rows={1}
          value={text}
          disabled={disabled || save.isPending}
          onChange={(e) => {
            setText(e.target.value.normalize("NFC"));
            setOmitted([]);
            setConfirm(false);
            setNow(new Date());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && lines.length === 1) {
              e.preventDefault();
              if (!blocked) {
                e.currentTarget.form?.requestSubmit();
              }
            }
          }}
        />
        <Button disabled={blocked}>Thêm</Button>
      </form>
      {!!text.trim() && (
        <div className="todo-quick-preview">
          {!literal &&
            parsed.map((p, index) => (
              <div key={index}>
                <strong>{p.title || "Chưa có tiêu đề"}</strong>
                <div>
                  {p.chips.map((chip) => (
                    <span className="todo-quick-chip" key={chip.id}>
                      {chip.label}
                      {
                        <>
                          <button
                            type="button"
                            aria-label={`Sửa ${chip.raw}`}
                            disabled={save.isPending}
                            onClick={() => {
                              const input = inputRef.current;
                              input?.focus();
                              input?.setSelectionRange(
                                (lineMatches[index].index ?? 0) + chip.start,
                                (lineMatches[index].index ?? 0) + chip.end,
                              );
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            aria-label={`Gỡ ${chip.raw}`}
                            disabled={save.isPending}
                            onClick={() =>
                              setOmitted((old) => [
                                ...old,
                                `${index}:${chip.id}`,
                              ])
                            }
                          >
                            ×
                          </button>
                        </>
                      }
                    </span>
                  ))}
                </div>
              </div>
            ))}
          <label>
            <input
              type="checkbox"
              checked={literal}
              disabled={save.isPending}
              onChange={(e) => setLiteral(e.target.checked)}
            />{" "}
            Giữ nguyên văn (không nhận diện)
          </label>
          {warnings.map((message, index) => (
            <p role="alert" key={index}>
              {message}
            </p>
          ))}
          {lines.length > 50 && (
            <p role="alert">
              <span>Tối đa 50 việc mỗi lần.</span>{" "}
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setText(lines.slice(0, 50).join("\n"));
                }}
              >
                Chỉ giữ 50 việc đầu tiên
              </button>
            </p>
          )}
          {lines.length > 1 && (
            <p>{lines.length} việc · kiểm tra trước khi thêm.</p>
          )}
        </div>
      )}
      {save.isError && <p role="alert">{errorMessage(save.error)}</p>}
      {confirm && (
        <Modal
          title={`Tạo ${items.length} việc?`}
          busy={save.isPending}
          onClose={() => setConfirm(false)}
        >
          <p>
            Mỗi dòng tạo một việc. Tất cả cùng được lưu; nếu một việc không hợp
            lệ, cả nhóm sẽ không được tạo.
          </p>
          <ul>
            {items.map((item, index) => (
              <li key={index}>{item.title}</li>
            ))}
          </ul>
          <Button disabled={blocked} onClick={() => save.mutate()}>
            Xác nhận thêm
          </Button>
        </Modal>
      )}
    </div>
  );
}
