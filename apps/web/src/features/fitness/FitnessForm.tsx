import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { useAuthStore } from "../auth/store";
import { localInputDate } from "../finance/api";
import { useFitnessMutation } from "./api";
import {
  Exercise,
  Session,
  WorkoutSet,
  Template,
  TemplateItem,
  Body,
  SetType,
  groups,
  setNames,
} from "./types";
export type FitnessDialog =
  | { kind: "session"; session?: Session; templateId?: string }
  | { kind: "set"; sessionId: string; set?: WorkoutSet; copy?: WorkoutSet }
  | { kind: "exercise"; exercise?: Exercise }
  | { kind: "body"; body?: Body }
  | { kind: "template"; template?: Template; items?: TemplateItem[] }
  | { kind: "goal"; target: number };
type Values = {
  name: string;
  muscleGroup: string;
  date: string;
  durationMinutes: string;
  notes: string;
  startTime: string;
  endTime: string;
  mood: string;
  bodyWeight: string;
  exerciseId: string;
  weight: string;
  reps: string;
  setType: SetType;
  rpe: string;
  done: boolean;
  waist: string;
  chest: string;
  hips: string;
  arm: string;
  thigh: string;
  sessionsPerWeek: string;
};
const optional = (v: string) => (v.trim() ? Number(v) : null);
const localTime = (v: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function FitnessForm({
  dialog,
  exercises,
  onClose,
  onSession,
}: {
  dialog: FitnessDialog;
  exercises: Exercise[];
  onClose: () => void;
  onSession?: (id: string) => void;
}) {
  const user = useAuthStore((s) => s.user)!;
  const session = dialog.kind === "session" ? dialog.session : undefined,
    set = dialog.kind === "set" ? (dialog.set ?? dialog.copy) : undefined,
    exercise = dialog.kind === "exercise" ? dialog.exercise : undefined,
    body = dialog.kind === "body" ? dialog.body : undefined,
    template = dialog.kind === "template" ? dialog.template : undefined;
  const [items, setItems] = useState<TemplateItem[]>(
      template?.items ??
        (dialog.kind === "template" ? (dialog.items ?? []) : []),
    ),
    [validation, setValidation] = useState("");
  const { register, handleSubmit, watch, setValue, getFieldState } =
    useForm<Values>({
      defaultValues: {
        name: exercise?.name ?? template?.name ?? "",
        muscleGroup: exercise?.muscleGroup ?? "Toàn thân",
        date:
          session?.date ??
          body?.date ??
          localInputDate(new Date(), user.timezone),
        durationMinutes: String(session?.durationMinutes ?? 45),
        notes: session?.notes ?? body?.notes ?? template?.notes ?? "",
        startTime: localTime(session?.startTime ?? null),
        endTime: localTime(session?.endTime ?? null),
        mood: session?.mood ? String(session.mood) : "",
        bodyWeight: session?.bodyWeight ? String(session.bodyWeight) : "",
        exerciseId: set?.exerciseId ?? exercises[0]?.id ?? "",
        weight:
          dialog.kind === "body"
            ? String(body?.weight ?? "")
            : String(set?.weight ?? 0),
        reps: String(set?.reps ?? 10),
        setType: set?.setType ?? "working",
        rpe: set?.rpe ? String(set.rpe) : "",
        done: set?.done ?? true,
        waist: body?.waist ? String(body.waist) : "",
        chest: body?.chest ? String(body.chest) : "",
        hips: body?.hips ? String(body.hips) : "",
        arm: body?.arm ? String(body.arm) : "",
        thigh: body?.thigh ? String(body.thigh) : "",
        sessionsPerWeek: dialog.kind === "goal" ? String(dialog.target) : "4",
      },
    });
  const selected = watch("exerciseId");
  useEffect(() => {
    if (dialog.kind !== "set" || set || !selected) return;
    let active = true;
    void apiClient
      .get<{ sets: WorkoutSet[]; date: string | null }>(
        "/fitness/last/" + selected,
      )
      .then((r) => {
        const previous = r.data.sets.at(-1);
        if (active && previous) {
          if (!getFieldState("weight").isDirty)
            setValue("weight", String(previous.weight));
          if (!getFieldState("reps").isDirty)
            setValue("reps", String(previous.reps));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selected, dialog.kind, set, setValue, getFieldState]);
  const save = useFitnessMutation(
    async (v: Values) => {
      setValidation("");
      if (dialog.kind === "session") {
        const payload = {
          date: v.date,
          durationMinutes: Number(v.durationMinutes),
          notes: v.notes,
          mood: optional(v.mood),
          bodyWeight: optional(v.bodyWeight),
          startTime: v.startTime ? new Date(v.startTime).toISOString() : null,
          endTime: v.endTime ? new Date(v.endTime).toISOString() : null,
        };
        if (!!payload.startTime !== !!payload.endTime)
          throw new Error("Nhập đủ giờ bắt đầu và kết thúc.");
        return session
          ? apiClient.put("/workout-sessions/" + session.id, {
              ...payload,
              revision: session.revision,
            })
          : apiClient.post(
              dialog.templateId
                ? `/workout-templates/${dialog.templateId}/start`
                : "/workout-sessions",
              payload,
            );
      }
      if (dialog.kind === "set") {
        const payload = {
          exerciseId: v.exerciseId,
          weight: Number(v.weight),
          reps: Number(v.reps),
          done: v.done,
          setType: v.setType,
          rpe: optional(v.rpe),
        };
        return dialog.set
          ? apiClient.put("/workout-sets/" + dialog.set.id, {
              ...payload,
              revision: dialog.set.revision,
            })
          : apiClient.post("/workout-sets", {
              ...payload,
              sessionId: dialog.sessionId,
            });
      }
      if (dialog.kind === "exercise")
        return exercise
          ? apiClient.put("/exercises/" + exercise.id, {
              name: v.name,
              muscleGroup: v.muscleGroup,
            })
          : apiClient.post("/exercises", {
              name: v.name,
              muscleGroup: v.muscleGroup,
            });
      if (dialog.kind === "body") {
        const payload = {
          date: v.date,
          weight: optional(v.weight),
          waist: optional(v.waist),
          chest: optional(v.chest),
          hips: optional(v.hips),
          arm: optional(v.arm),
          thigh: optional(v.thigh),
          notes: v.notes,
        };
        return body
          ? apiClient.put("/body-metrics/" + body.id, {
              ...payload,
              revision: body.revision,
            })
          : apiClient.post("/body-metrics", payload);
      }
      if (dialog.kind === "template") {
        if (!items.length) throw new Error("Thêm ít nhất một set vào mẫu.");
        const payload = { name: v.name, notes: v.notes, items };
        return template
          ? apiClient.put("/workout-templates/" + template.id, {
              ...payload,
              revision: template.revision,
            })
          : apiClient.post("/workout-templates", payload);
      }
      return apiClient.put("/fitness/goal", {
        sessionsPerWeek: Number(v.sessionsPerWeek),
      });
    },
    (result) => {
      if (dialog.kind === "session" && !session) {
        const response = result as { data: { id: string } };
        if (response.data.id) onSession?.(response.data.id);
      }
      onClose();
    },
  );
  const submit = (v: Values) => {
    if (
      dialog.kind === "body" &&
      ![v.weight, v.waist, v.chest, v.hips, v.arm, v.thigh].some(
        (x) => Number(x) > 0,
      )
    ) {
      setValidation("Nhập cân nặng hoặc ít nhất một số đo.");
      return;
    }
    save.mutate(v);
  };
  const number = (
    name: keyof Values,
    label: string,
    min = 0,
    max = 1000,
    step: number | string = "any",
    required = true,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        required={required}
        {...register(name)}
      />
    </label>
  );
  return (
    <Modal
      title={
        {
          session: "Ghi buổi tập",
          set: "Ghi set",
          exercise: "Bài tập",
          body: "Số đo cơ thể",
          template: "Mẫu buổi tập",
          goal: "Mục tiêu mỗi tuần",
        }[dialog.kind]
      }
      onClose={onClose}
      busy={save.isPending}
    >
      <form
        className="settings-form finance-form fitness-form"
        onSubmit={handleSubmit(submit)}
      >
        <fieldset disabled={save.isPending}>
          {["exercise", "template"].includes(dialog.kind) && (
            <label>
              Tên
              <input
                aria-label="Tên"
                required
                maxLength={100}
                {...register("name")}
              />
            </label>
          )}
          {dialog.kind === "exercise" && (
            <label>
              Nhóm cơ
              <select aria-label="Nhóm cơ" {...register("muscleGroup")}>
                {groups.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
          {["session", "body"].includes(dialog.kind) && (
            <label>
              Ngày
              <input
                aria-label="Ngày"
                type="date"
                required
                {...register("date")}
              />
            </label>
          )}
          {dialog.kind === "session" && (
            <>
              <div className="form-two-columns">
                {number("durationMinutes", "Thời gian (phút)", 0.01, 1440)}
                {number(
                  "bodyWeight",
                  "Cân nặng buổi tập (kg)",
                  1,
                  500,
                  "any",
                  false,
                )}
                <label>
                  Cảm giác
                  <select aria-label="Cảm giác" {...register("mood")}>
                    <option value="">Chưa ghi</option>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <option key={i} value={i}>
                        {i}/5
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <details>
                <summary>Giờ bắt đầu và kết thúc (tùy chọn)</summary>
                <p className="muted">
                  Giờ theo thiết bị của bạn. Khi nhập đủ hai giờ, thời gian tập
                  được tính tự động.
                </p>
                <div className="form-two-columns">
                  <label>
                    Bắt đầu
                    <input
                      aria-label="Bắt đầu"
                      type="datetime-local"
                      {...register("startTime")}
                    />
                  </label>
                  <label>
                    Kết thúc
                    <input
                      aria-label="Kết thúc"
                      type="datetime-local"
                      {...register("endTime")}
                    />
                  </label>
                </div>
              </details>
            </>
          )}
          {["set", "template"].includes(dialog.kind) && (
            <>
              <label>
                Bài tập
                <select
                  aria-label="Bài tập"
                  required
                  {...register("exerciseId")}
                >
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-two-columns">
                {number("weight", "Trọng lượng (kg)")}
                {number("reps", "Số rep", 1, 1000, 1)}
                <label>
                  Loại set
                  <select aria-label="Loại set" {...register("setType")}>
                    {Object.entries(setNames).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                {number("rpe", "RPE (tùy chọn)", 1, 10, 0.5, false)}
              </div>
              {dialog.kind === "set" && (
                <>
                  <label className="checkbox-label">
                    <input type="checkbox" {...register("done")} />
                    Đã hoàn thành set
                  </label>
                  <p className="muted">
                    Bài đã tập trước được điền kg/rep từ buổi gần nhất. Set chưa
                    hoàn thành không tính volume hoặc PR.
                  </p>
                </>
              )}
              {dialog.kind === "template" && (
                <>
                  <Button
                    type="button"
                    className="button-outline"
                    disabled={items.length >= 100 || !selected}
                    onClick={() => {
                      setItems((a) => [
                        ...a,
                        {
                          exerciseId: selected,
                          weight: Number(watch("weight")),
                          reps: Number(watch("reps")),
                          setType: watch("setType"),
                          rpe: optional(watch("rpe")),
                        },
                      ]);
                    }}
                  >
                    Thêm set vào mẫu
                  </Button>
                  {items.map((r, i) => (
                    <div className="fitness-template-item" key={i}>
                      <span>
                        {i + 1}.{" "}
                        {exercises.find((e) => e.id === r.exerciseId)?.name ??
                          "Bài tập"}{" "}
                        · {r.weight} kg × {r.reps} · {setNames[r.setType]}
                      </span>
                      <Button
                        type="button"
                        className="button-outline"
                        onClick={() =>
                          setItems((a) => a.filter((_, k) => k !== i))
                        }
                      >
                        Bỏ
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          {dialog.kind === "body" && (
            <div className="form-two-columns">
              {number("weight", "Cân nặng (kg)", 1, 500, "any", false)}
              {(["waist", "chest", "hips", "arm", "thigh"] as const).map(
                (k, i) => (
                  <div key={k}>
                    {number(
                      k,
                      [
                        "Eo (cm)",
                        "Ngực (cm)",
                        "Hông (cm)",
                        "Tay (cm)",
                        "Đùi (cm)",
                      ][i],
                      1,
                      300,
                      "any",
                      false,
                    )}
                  </div>
                ),
              )}
            </div>
          )}
          {dialog.kind === "goal" &&
            number("sessionsPerWeek", "Số buổi mỗi tuần", 1, 14, 1)}
          {["session", "body", "template"].includes(dialog.kind) && (
            <label>
              Ghi chú
              <textarea
                aria-label="Ghi chú"
                maxLength={2000}
                {...register("notes")}
              />
            </label>
          )}
          {validation && (
            <p role="alert" className="form-error">
              {validation}
            </p>
          )}
          {save.isError && (
            <p role="alert" className="form-error">
              {save.error instanceof Error &&
              !(save.error as { isAxiosError?: boolean }).isAxiosError
                ? save.error.message
                : errorMessage(save.error)}
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
