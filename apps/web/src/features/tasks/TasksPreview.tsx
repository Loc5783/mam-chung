import { Link } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { Card, Button, Skeleton } from "../../components/ui";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { Task, TaskPage } from "./types";
import { useTaskMutation, useTasksQuery } from "./api";
function Error({ error }: { error: unknown }) {
  return <p role="alert">{errorMessage(error)}</p>;
}
export function TasksPreview({
  provided,
}: {
  provided?: { today: TaskPage; overdue: TaskPage };
}) {
  const aq = useTasksQuery<TaskPage>(
      "/tasks",
      { due: "today", limit: 5 },
      !provided,
    ),
    bq = useTasksQuery<TaskPage>(
      "/tasks",
      { due: "overdue", limit: 5 },
      !provided,
    );
  const a = provided
      ? { data: provided.today, isPending: false, isError: false, error: null }
      : aq,
    b = provided
      ? {
          data: provided.overdue,
          isPending: false,
          isError: false,
          error: null,
        }
      : bq;
  const change = useTaskMutation(async (t: Task) =>
    apiClient.patch("/tasks/" + t.id + "/status", {
      status: "DONE",
      revision: t.revision,
    }),
  );
  return (
    <Card>
      <div className="section-heading">
        <h2>Công việc hôm nay</h2>
        <CheckSquare size={23} />
      </div>
      {a.isPending || b.isPending ? (
        <Skeleton />
      ) : a.isError || b.isError ? (
        <Error error={a.error ?? b.error} />
      ) : (
        <>
          {[
            { title: `Hôm nay (${a.data!.total})`, items: a.data!.items },
            { title: `Quá hạn (${b.data!.total})`, items: b.data!.items },
          ].map((g) => (
            <div key={g.title}>
              <h3>{g.title}</h3>
              {g.items.length ? (
                g.items.map((t, i) => (
                  <div
                    key={t.id}
                    className="task-preview-row stagger-item"
                    style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  >
                    <span>
                      {t.title}{" "}
                      <small>{t.coupleId ? "Chung" : "Cá nhân"}</small>
                    </span>
                    <Button
                      className="button-outline"
                      disabled={change.isPending}
                      onClick={() => change.mutate(t)}
                    >
                      Xong
                    </Button>
                  </div>
                ))
              ) : (
                <p className="muted">Không có việc cần làm.</p>
              )}
            </div>
          ))}
        </>
      )}
      {change.isError && <Error error={change.error} />}
      <Link className="card-link" to="/tasks">
        Xem tất cả công việc →
      </Link>
    </Card>
  );
}
