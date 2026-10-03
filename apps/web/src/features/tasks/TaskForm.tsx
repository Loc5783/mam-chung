import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { Button } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { useAuthStore } from "../auth/store";
import { useTaskMutation } from "./api";
import { Task, Members, ChecklistItem, priorities } from "./types";
const schema = z
  .object({
    title: z.string().trim().min(1, "Nhập tiêu đề công việc.").max(160),
    description: z.string().max(2000),
    scope: z.enum(["personal", "shared"]),
    deadline: z.string(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    assignedTo: z.string(),
    kind: z.enum(["task", "shopping"]),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
    labels: z.string(),
  })
  .refine((v) => v.recurrence === "none" || !!v.deadline, {
    path: ["deadline"],
    message: "Việc lặp lại cần hạn chót.",
  });
type Values = z.infer<typeof schema>;
export function TaskForm({
  task,
  members,
  onClose,
  shopping = false,
}: {
  task?: Task;
  members: Members;
  onClose: () => void;
  shopping?: boolean;
}) {
  const user = useAuthStore((s) => s.user)!;
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
      task?.checklist ?? [],
    ),
    [text, setText] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      scope: task?.coupleId ? "shared" : shopping ? "shared" : "personal",
      deadline: task?.deadline ?? "",
      priority: task?.priority ?? "MEDIUM",
      assignedTo: task?.assignedTo ?? (!task ? user.id : ""),
      kind: task?.kind ?? (shopping ? "shopping" : "task"),
      recurrence: task?.recurrence ?? "none",
      labels: task?.labels.join(", ") ?? "",
    },
  });
  const scope = watch("scope");
  const save = useTaskMutation(async (v: Values) => {
    const { scope, ...values } = v;
    const body = {
      ...values,
      deadline: v.deadline || null,
      assignedTo: v.assignedTo || null,
      labels: v.labels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      checklist,
    };
    return task
      ? apiClient.put("/tasks/" + task.id, { ...body, revision: task.revision })
      : apiClient.post("/tasks", { ...body, scope });
  }, onClose);
  return (
    <Modal
      title={task ? "Sửa công việc" : "Thêm công việc"}
      onClose={onClose}
      busy={save.isPending}
    >
      <form
        className="settings-form finance-form task-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
      >
        <fieldset disabled={save.isPending}>
          <label>
            Tiêu đề
            <input
              aria-label="Tiêu đề"
              {...register("title")}
              maxLength={160}
            />
            {errors.title && (
              <span className="form-error">{errors.title.message}</span>
            )}
          </label>
          <label>
            Mô tả
            <textarea
              aria-label="Mô tả"
              {...register("description")}
              maxLength={2000}
            />
          </label>
          <div className="form-two-columns">
            <label>
              Không gian
              <select
                aria-label="Không gian"
                {...register("scope")}
                disabled={!!task}
                onChange={(e) => {
                  setValue("scope", e.target.value as Values["scope"]);
                  setValue(
                    "assignedTo",
                    e.target.value === "personal" ? user.id : "",
                  );
                }}
              >
                <option value="personal">Cá nhân</option>
                <option
                  value="shared"
                  disabled={!user.coupleId || members.readOnly}
                >
                  Chung
                </option>
              </select>
            </label>
            <label>
              Loại
              <select aria-label="Loại công việc" {...register("kind")}>
                <option value="task">Công việc</option>
                <option value="shopping">Danh sách mua sắm</option>
              </select>
            </label>
            <label>
              Ưu tiên
              <select aria-label="Ưu tiên" {...register("priority")}>
                {Object.entries(priorities).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Người thực hiện
              <select aria-label="Người thực hiện" {...register("assignedTo")}>
                <option value="">Chưa giao</option>
                {(scope === "personal"
                  ? [{ id: user.id, name: user.name }]
                  : members.items
                ).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hạn chót
              <input
                aria-label="Hạn chót"
                type="date"
                {...register("deadline")}
              />
              {errors.deadline && (
                <span className="form-error">{errors.deadline.message}</span>
              )}
            </label>
            <label>
              Lặp lại
              <select aria-label="Lặp lại" {...register("recurrence")}>
                <option value="none">Không lặp</option>
                <option value="daily">Hằng ngày</option>
                <option value="weekly">Hằng tuần</option>
                <option value="monthly">Hằng tháng</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Hoàn thành sẽ tạo một bản kế tiếp, theo hạn chót cũ. Việc con được
            bỏ tick trong bản mới. Mở lại việc cũ không tạo thêm bản trùng.
          </p>
          <label>
            Nhãn (ngăn bằng dấu phẩy)
            <input aria-label="Nhãn" {...register("labels")} />
          </label>
          <h3>{watch("kind") === "shopping" ? "Món cần mua" : "Việc con"}</h3>
          <div className="task-checklist">
            {checklist.map((i) => (
              <div key={i.id}>
                <label className="checkbox-label">
                  <input
                    aria-label={`Hoàn thành ${i.text}`}
                    type="checkbox"
                    checked={i.done}
                    onChange={(e) =>
                      setChecklist((a) =>
                        a.map((j) =>
                          j.id === i.id ? { ...j, done: e.target.checked } : j,
                        ),
                      )
                    }
                  />
                  {i.text}
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Bỏ ${i.text}`}
                  onClick={() =>
                    setChecklist((a) => a.filter((j) => j.id !== i.id))
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="task-add-item">
            <input
              aria-label="Nội dung việc con"
              value={text}
              maxLength={200}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              type="button"
              className="button-outline"
              disabled={!text.trim() || checklist.length >= 100}
              onClick={() => {
                setChecklist((a) => [
                  ...a,
                  { id: crypto.randomUUID(), text: text.trim(), done: false },
                ]);
                setText("");
              }}
            >
              Thêm mục
            </Button>
          </div>
          {save.isError && (
            <p role="alert" className="form-error">
              {errorMessage(save.error)} Nếu có người khác vừa sửa, đóng hộp
              thoại và mở lại để dùng dữ liệu mới.
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" className="button-outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit">
              {save.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
