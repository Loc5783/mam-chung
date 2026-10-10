import { useEffect, useState } from "react";
import { Button } from "../../../components/ui";
import { apiClient, errorMessage } from "../../../lib/apiClient";
import { useAuthStore } from "../../auth/store";
import { useTaskMutation, useTasksQuery } from "../api";
import { useFocusStore, focusElapsed } from "../store/focus";
import type { Task } from "../types";
export function FocusMode({
  tasks,
  disabled,
  onCheck,
}: {
  tasks: Task[];
  disabled: boolean;
  onCheck: (task: Task, id: string, done: boolean) => void;
}) {
  const user = useAuthStore((s) => s.user)!,
    { session, set } = useFocusStore(),
    [picked, setPicked] = useState(""),
    [work, setWork] = useState(25),
    [rest, setRest] = useState(5),
    [longRest, setLongRest] = useState(15),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const elapsed = session ? focusElapsed(session, now) : 0,
    remaining = session
      ? Math.max(
          0,
          Math.ceil(
            ((session.phase === "work"
              ? session.workMinutes
              : session.restMinutes) *
              60000 -
              elapsed) /
              1000,
          ),
        )
      : work * 60;
  const q = useTasksQuery<Task>(
    `/tasks/${session?.taskId ?? "none"}`,
    {},
    !!session,
  );
  const log = useTaskMutation(
    async (value: { taskId: string; sessionId: string; seconds: number }) =>
      apiClient.post(`/tasks/${value.taskId}/time`, {
        sessionId: value.sessionId,
        seconds: value.seconds,
      }),
    () => {
      const current = useFocusStore.getState().session;
      if (current)
        set({
          ...current,
          phase: "rest",
          elapsedMs: 0,
          runningSince: null,
          pendingSeconds: null,
          sessionId: crypto.randomUUID(),
        });
    },
  );
  const stop = () => {
    if (!session) return;
    const seconds =
      session.pendingSeconds ??
      Math.floor(focusElapsed(session, Date.now()) / 1000);
    if (session.phase === "rest") {
      set(null);
      return;
    }
    set({
      ...session,
      elapsedMs: seconds * 1000,
      runningSince: null,
      pendingSeconds: seconds,
    });
    if (seconds > 0)
      log.mutate({
        taskId: session.taskId,
        sessionId: session.sessionId,
        seconds,
      });
  };
  useEffect(() => {
    if (!session?.runningSince || remaining !== 0) return;
    if (session.phase === "rest")
      set({
        ...session,
        phase: "work",
        runningSince: null,
        elapsedMs: 0,
        sessionId: crypto.randomUUID(),
      });
    else
      set({
        ...session,
        elapsedMs: session.workMinutes * 60000,
        runningSince: null,
      });
  }, [remaining, session, set]);
  return (
    <section className="todo-focus">
      <h2>Một việc, một khoảng tập trung 🌱</h2>
      {!session ? (
        <>
          <label>
            Chọn công việc
            <select
              aria-label="Việc tập trung"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="">Chọn…</option>
              {tasks
                .filter(
                  (t) =>
                    !t.readOnly && !["DONE", "CANCELLED"].includes(t.status),
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tập trung (phút)
            <input
              type="number"
              aria-label="Thời gian tập trung"
              min={1}
              max={180}
              value={work}
              onChange={(e) => setWork(Number(e.target.value))}
            />
          </label>
          <label>
            Nghỉ ngắn (phút)
            <input
              type="number"
              aria-label="Thời gian nghỉ ngắn"
              min={1}
              max={60}
              value={rest}
              onChange={(e) => setRest(Number(e.target.value))}
            />
          </label>
          <label>
            Nghỉ dài (phút)
            <input
              type="number"
              aria-label="Thời gian nghỉ dài"
              min={1}
              max={60}
              value={longRest}
              onChange={(e) => setLongRest(Number(e.target.value))}
            />
          </label>
          <p className="todo-focus-notice" role="note">
            Chỉ chạy khi tab đang mở.
          </p>
          <Button
            disabled={
              disabled ||
              !picked ||
              !Number.isInteger(work) ||
              work < 1 ||
              work > 180 ||
              !Number.isInteger(rest) ||
              rest < 1 ||
              rest > 60 ||
              !Number.isInteger(longRest) ||
              longRest < 1 ||
              longRest > 60
            }
            onClick={() => {
              const task = tasks.find((t) => t.id === picked)!;
              set({
                userId: user.id,
                taskId: task.id,
                title: task.title,
                phase: "work",
                workMinutes: work,
                restMinutes: rest,
                longRestMinutes: longRest,
                restType: "short",
                elapsedMs: 0,
                runningSince: Date.now(),
                sessionId: crypto.randomUUID(),
                pendingSeconds: null,
              });
              setNow(Date.now());
            }}
          >
            Bắt đầu tập trung
          </Button>
        </>
      ) : (
        <>
          <h3>{q.data?.title ?? session.title}</h3>
          <p>
            {session.phase === "work"
              ? "Tập trung"
              : session.restType === "long"
                ? "Nghỉ dài"
                : "Nghỉ nhẹ"}
          </p>
          <p className="todo-focus-notice" role="note">
            Chỉ chạy khi tab đang mở.
          </p>
          {session.phase === "rest" && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "center",
              }}
            >
              <Button
                className={session.restType !== "long" ? "" : "button-outline"}
                disabled={log.isPending}
                onClick={() => {
                  set({
                    ...session,
                    restType: "short",
                    restMinutes: rest,
                    elapsedMs: 0,
                    runningSince: session.runningSince ? Date.now() : null,
                  });
                }}
              >
                Nghỉ ngắn ({rest}p)
              </Button>
              <Button
                className={session.restType === "long" ? "" : "button-outline"}
                disabled={log.isPending}
                onClick={() => {
                  set({
                    ...session,
                    restType: "long",
                    restMinutes: session.longRestMinutes ?? longRest,
                    elapsedMs: 0,
                    runningSince: session.runningSince ? Date.now() : null,
                  });
                }}
              >
                Nghỉ dài ({session.longRestMinutes ?? longRest}p)
              </Button>
            </div>
          )}
          <div
            className="todo-focus-clock"
            role="timer"
            aria-label="Thời gian còn lại"
          >
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
          <Button
            disabled={
              log.isPending || !!session.pendingSeconds || q.data?.readOnly
            }
            onClick={() => {
              const current = Date.now();
              set({
                ...session,
                elapsedMs: focusElapsed(session, current),
                runningSince: session.runningSince ? null : current,
              });
              setNow(current);
            }}
          >
            {session.runningSince ? "Tạm dừng" : "Tiếp tục"}
          </Button>
          <Button
            disabled={
              disabled ||
              log.isPending ||
              q.isError ||
              q.data?.readOnly ||
              (session.phase === "work" && elapsed < 1000)
            }
            onClick={stop}
          >
            {session.phase === "work"
              ? session.pendingSeconds
                ? "Thử lưu lại"
                : "Dừng và lưu thời gian"
              : "Kết thúc nghỉ"}
          </Button>
          {remaining === 0 && session.phase === "work" && (
            <p>Phiên đã xong. Lưu thời gian rồi nghỉ nhé.</p>
          )}
          {q.isError && (
            <p role="alert">
              {errorMessage(q.error)}{" "}
              <Button onClick={() => void q.refetch()}>Thử tải lại</Button>
            </p>
          )}
          {log.isError && (
            <p role="alert">
              {errorMessage(log.error)} · Thời gian vẫn được giữ để thử lưu lại.
            </p>
          )}
          {q.data?.checklist.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={item.done}
                disabled={disabled || log.isPending || q.data?.readOnly}
                onChange={(e) => onCheck(q.data!, item.id, e.target.checked)}
              />
              {item.text}
            </label>
          ))}
          <p>
            Đã ghi nhận: {Math.floor((q.data?.timeSpentSeconds ?? 0) / 60)}{" "}
            phút. Khi chuyển trang, đồng hồ tiếp tục theo thời điểm bắt đầu;
            đóng hoặc tải lại tab sẽ kết thúc phần thời gian chưa lưu.
          </p>
        </>
      )}
    </section>
  );
}
