import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { Plus, Dumbbell } from "lucide-react";
import { Card, Button, EmptyState, Skeleton } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { useFitnessQuery, useFitnessMutation } from "./api";
import {
  Exercise,
  Session,
  WorkoutSet,
  Template,
  Body,
  Page,
  Report,
  setNames,
} from "./types";
import { FitnessDialog, FitnessForm } from "./FitnessForm";
const fmt = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
export function RestTimer() {
  const [seconds, setSeconds] = useState(90),
    [left, setLeft] = useState(90),
    [end, setEnd] = useState<number | null>(null);
  useEffect(() => {
    if (end === null) return;
    const tick = () => {
      const value = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(value);
      if (!value) setEnd(null);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [end]);
  return (
    <div className="fitness-timer">
      <label>
        Nghỉ giữa set (giây)
        <input
          aria-label="Thời gian nghỉ"
          type="number"
          min={10}
          max={600}
          value={seconds}
          disabled={end !== null}
          onChange={(e) => {
            const n = Number(e.target.value);
            setSeconds(n);
            setLeft(n);
          }}
        />
      </label>
      <b role="timer" aria-label="Thời gian còn lại">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </b>
      <Button
        className="button-outline"
        disabled={!Number.isInteger(seconds) || seconds < 10 || seconds > 600}
        onClick={() =>
          end === null
            ? setEnd(Date.now() + Math.max(1, left || seconds) * 1000)
            : setEnd(null)
        }
      >
        {end === null ? "Bắt đầu / tiếp tục" : "Tạm dừng"}
      </Button>
      <Button
        className="button-outline"
        onClick={() => {
          setEnd(null);
          setLeft(seconds);
        }}
      >
        Đặt lại
      </Button>
      {left === 0 && <span role="status">Hết giờ nghỉ</span>}
    </div>
  );
}
function ErrorBox({ error }: { error: unknown }) {
  return (
    <p role="alert" className="form-error">
      {errorMessage(error)}
    </p>
  );
}
function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} dòng · Trang {page}
      </span>
      <Button
        className="button-outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Trước
      </Button>
      <Button
        className="button-outline"
        disabled={page * 20 >= total}
        onClick={() => onPage(page + 1)}
      >
        Sau
      </Button>
    </div>
  );
}
function Chart({
  rows,
  keys,
}: {
  rows: Record<string, unknown>[];
  keys: { key: string; name: string; color: string }[];
}) {
  return rows.length ? (
    <div className="fitness-chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e8d9" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          {keys.map((k) => (
            <Line
              key={k.key}
              type="monotone"
              dataKey={k.key}
              name={k.name}
              stroke={k.color}
              strokeWidth={2}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <EmptyState title="Chưa có dữ liệu">
      Ghi lại buổi tập hoặc số đo để xem tiến trình.
    </EmptyState>
  );
}
function Analytics({
  report,
  exerciseSelected,
  onGoal,
  onContinue,
}: {
  report: Report;
  exerciseSelected: boolean;
  onGoal: () => void;
  onContinue: () => void;
}) {
  const [metric, setMetric] = useState("weight");
  return (
    <>
      <div className="fitness-stats">
        {[
          ["Buổi tuần này", report.stats.weekSessions],
          ["Buổi tháng này", report.stats.monthSessions],
          ["TB rep/set", report.stats.averageReps],
          ["TB phút/buổi", report.stats.averageMinutes],
          ["Tổng phút", report.stats.totalMinutes],
          ["Volume gần nhất", report.stats.lastVolume],
          ["Buổi / tuần trong khoảng", report.stats.frequencyPerWeek],
        ].map(([label, value]) => (
          <Card key={label}>
            <span>{label}</span>
            <h2>{fmt(Number(value))}</h2>
          </Card>
        ))}
      </div>
      <Card>
        <div className="section-heading">
          <h2>Mục tiêu mỗi tuần</h2>
          <Button className="button-outline" onClick={onGoal}>
            Sửa mục tiêu
          </Button>
        </div>
        <p>
          {report.weeklyGoal.done}/{report.weeklyGoal.target} buổi trong tuần
          lịch hiện tại
        </p>
        <progress
          max={100}
          value={report.weeklyGoal.progress}
          aria-label="Tiến độ tuần"
        />
      </Card>
      {report.continueFrom && (
        <Card>
          <div className="section-heading">
            <h2>Tiếp tục từ buổi gần nhất</h2>
            <Button className="button-outline" onClick={onContinue}>
              Ghi buổi tiếp theo
            </Button>
          </div>
          <p>
            {report.continueFrom.date} · {report.continueFrom.durationMinutes}{" "}
            phút
          </p>
          {report.continueFrom.sets.some((r) => r.done) ? (
            <div className="fitness-actions">
              {[
                ...new Map(
                  report.continueFrom.sets
                    .filter((r) => r.done)
                    .map((r) => [r.exerciseId, r]),
                ).values(),
              ].map((r) => (
                <span className="fitness-template-item" key={r.exerciseId}>
                  {r.exerciseName}: {r.weight} kg × {r.reps} rep
                </span>
              ))}
            </div>
          ) : (
            <p>
              Buổi gần nhất chưa có set hoàn thành. Khi thêm set, kg/rep vẫn
              được gợi ý từ buổi đã tập trước đó.
            </p>
          )}
        </Card>
      )}
      <div className="fitness-two-columns">
        <Card>
          <h2>Volume theo buổi</h2>
          <p className="muted">Tổng kg × rep của các set đã hoàn thành.</p>
          <Chart
            rows={report.volume}
            keys={[
              { key: "volume", name: "Volume (kg × rep)", color: "#7e9b57" },
            ]}
          />
          <details>
            <summary>Bảng số liệu volume</summary>
            {report.volume.map((p) => (
              <p key={p.sessionId}>
                {p.date}: {fmt(p.volume)} kg × rep
              </p>
            ))}
          </details>
        </Card>
        <Card>
          <h2>Phân bố theo rep</h2>
          {report.repDistribution.some((r) => r.count) ? (
            <div className="fitness-chart">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={report.repDistribution}
                    nameKey="name"
                    dataKey="count"
                    innerRadius={65}
                    outerRadius={95}
                  >
                    {["#b3577a", "#7e9b57", "#b9cc9a"].map((c) => (
                      <Cell key={c} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Chưa có set hoàn thành">
              Set chưa tick không được đưa vào thống kê.
            </EmptyState>
          )}
          {report.repDistribution.map((r) => (
            <p key={r.name}>
              {r.name} ({r.range}):{" "}
              <b>
                {r.count} set · {r.percent}%
              </b>
            </p>
          ))}
        </Card>
      </div>
      <Card>
        <h2>Trọng lượng & 1RM từng bài</h2>
        {exerciseSelected ? (
          <>
            <Chart
              rows={report.progress}
              keys={[
                { key: "maxWeight", name: "Kg cao nhất", color: "#7e9b57" },
                { key: "oneRM", name: "1RM ước tính (kg)", color: "#b3577a" },
              ]}
            />
            <p className="muted">
              1RM ước tính Epley = kg × (1 + rep/30). Bỏ set khởi động, chỉ tính
              set đã hoàn thành.
            </p>
            <details>
              <summary>Bảng tiến triển</summary>
              {report.progress.map((p) => (
                <p key={p.sessionId}>
                  {p.date}: {p.maxWeight ?? "—"} kg · 1RM {p.oneRM ?? "—"} kg
                </p>
              ))}
            </details>
          </>
        ) : (
          <p>
            Chọn một bài tập trong bộ lọc để xem tiến triển riêng của bài đó.
          </p>
        )}
      </Card>
      <Card>
        <h2>Tuần này so với tuần trước</h2>
        <div className="table-scroll">
          <table className="fitness-table">
            <thead>
              <tr>
                <th>Chỉ số</th>
                <th>Tuần trước</th>
                <th>Tuần này</th>
                <th>Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {(["sessions", "volume", "averageReps"] as const).map((k, i) => (
                <tr key={k}>
                  <td>{["Số buổi", "Volume", "TB rep/set"][i]}</td>
                  <td>{fmt(report.comparison.previous[k])}</td>
                  <td>{fmt(report.comparison.current[k])}</td>
                  <td>{fmt(report.comparison.delta[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2>Kỷ lục cá nhân</h2>
        <p className="muted">
          Mốc đầu tiên ghi riêng; PR được so với toàn bộ lịch sử trước đó, không
          chỉ khoảng đang lọc. Không tính set khởi động.
        </p>
        {report.prs.length ? (
          report.prs.map((r, i) => (
            <article
              className="fitness-pr"
              key={`${r.sessionId}-${r.exerciseId}-${i}`}
            >
              <b>
                {r.baseline ? "Mốc đầu" : "★ PR mới"} · {r.exerciseName}
              </b>
              <span>
                {r.date} · {r.flags.weight ? `Kg: ${r.weight} ` : ""}
                {r.flags.volume ? `Volume: ${fmt(r.volume)} ` : ""}
                {r.flags.oneRM ? `1RM: ${fmt(r.oneRM)} kg` : ""}
              </span>
            </article>
          ))
        ) : (
          <p>Chưa có mốc mới trong khoảng này.</p>
        )}
      </Card>
      <Card>
        <div className="section-heading">
          <h2>Cân nặng & số đo</h2>
          <select
            aria-label="Chỉ số biểu đồ cơ thể"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {["weight", "waist", "chest", "hips", "arm", "thigh"].map(
              (k, i) => (
                <option key={k} value={k}>
                  {
                    [
                      "Cân nặng (kg)",
                      "Eo (cm)",
                      "Ngực (cm)",
                      "Hông (cm)",
                      "Tay (cm)",
                      "Đùi (cm)",
                    ][i]
                  }
                </option>
              ),
            )}
          </select>
        </div>
        <Chart
          rows={report.body}
          keys={[
            {
              key: metric,
              name: metric === "weight" ? "kg" : "cm",
              color: "#7e9b57",
            },
          ]}
        />
      </Card>
    </>
  );
}
type DeleteTarget = { path: string; name: string; revision?: number };
function SessionDetail({
  id,
  exercises,
  onClose,
  onEdit,
  onDelete,
}: {
  id: string;
  exercises: Exercise[];
  onClose: () => void;
  onEdit: (d: FitnessDialog) => void;
  onDelete: (d: DeleteTarget) => void;
}) {
  const q = useFitnessQuery<Session>("/workout-sessions/" + id);
  const copy = useFitnessMutation(async (r: WorkoutSet) =>
    apiClient.post("/workout-sets", {
      sessionId: id,
      exerciseId: r.exerciseId,
      weight: r.weight,
      reps: r.reps,
      setType: r.setType,
      rpe: r.rpe,
      done: true,
    }),
  );
  const tick = useFitnessMutation(async (r: WorkoutSet) =>
    apiClient.put("/workout-sets/" + r.id, {
      done: !r.done,
      revision: r.revision,
    }),
  );
  return (
    <Card>
      <div className="section-heading">
        <h2>Ghi set cho buổi tập</h2>
        <Button className="button-outline" onClick={onClose}>
          Đóng chi tiết
        </Button>
      </div>
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          <p>
            {q.data.date} · {q.data.durationMinutes} phút · Volume{" "}
            {fmt(q.data.volume)}
          </p>
          <div className="fitness-actions">
            <Button
              onClick={() => onEdit({ kind: "set", sessionId: id })}
              disabled={!exercises.length}
            >
              Thêm set
            </Button>
            <Button
              className="button-outline"
              onClick={() => onEdit({ kind: "session", session: q.data })}
            >
              Sửa buổi tập
            </Button>
            <Button
              className="button-outline"
              disabled={!q.data.sets.length}
              onClick={() =>
                onEdit({
                  kind: "template",
                  items: q.data.sets.map((r) => ({
                    exerciseId: r.exerciseId,
                    weight: r.weight,
                    reps: r.reps,
                    setType: r.setType,
                    rpe: r.rpe,
                  })),
                })
              }
            >
              Lưu thành mẫu
            </Button>
          </div>
          <RestTimer />
          {q.data.sets.length ? (
            <div className="fitness-sets">
              {q.data.sets.map((r) => (
                <article key={r.id}>
                  <label className="checkbox-label">
                    <input
                      aria-label={`Hoàn thành ${r.exerciseName} set ${r.setNumber}`}
                      type="checkbox"
                      checked={r.done}
                      disabled={tick.isPending}
                      onChange={() => tick.mutate(r)}
                    />
                    <b>
                      {r.exerciseName} · Set {r.setNumber}
                    </b>
                  </label>
                  <p>
                    {r.weight} kg × {r.reps} rep · {setNames[r.setType]}
                    {r.rpe ? ` · RPE ${r.rpe}` : ""}
                  </p>
                  <div className="fitness-actions">
                    <Button
                      className="button-outline"
                      onClick={() =>
                        onEdit({ kind: "set", sessionId: id, set: r })
                      }
                    >
                      Sửa set
                    </Button>
                    <Button
                      className="button-outline"
                      disabled={copy.isPending}
                      onClick={() => copy.mutate(r)}
                    >
                      Sao chép set
                    </Button>
                    <Button
                      className="button-outline"
                      onClick={() =>
                        onDelete({
                          path: "/workout-sets/" + r.id,
                          name: `${r.exerciseName} set ${r.setNumber}`,
                          revision: r.revision,
                        })
                      }
                    >
                      Xóa set
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Buổi tập chưa có set">
              Thêm bài tập, kg và rep để bắt đầu ghi nhận.
            </EmptyState>
          )}
          {copy.isError && <ErrorBox error={copy.error} />}{" "}
          {tick.isError && <ErrorBox error={tick.error} />}
        </>
      )}
    </Card>
  );
}
export function FitnessPage() {
  const [tab, setTab] = useState("overview"),
    [range, setRange] = useState("30d"),
    [exerciseId, setExerciseId] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null),
    [dialog, setDialog] = useState<FitnessDialog | null>(null),
    [deleting, setDeleting] = useState<DeleteTarget | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const exercises = useFitnessQuery<{ items: Exercise[] }>("/exercises");
  const params = Object.fromEntries(
    Object.entries({ range, exerciseId, from, to }).filter(([, v]) => v),
  );
  const report = useFitnessQuery<Report>("/fitness/stats", params);
  const sessions = useFitnessQuery<Page<Session>>("/workout-sessions", {
    page,
    limit: 20,
    ...Object.fromEntries(Object.entries({ from, to }).filter(([, v]) => v)),
  });
  const templates = useFitnessQuery<{ items: Template[] }>(
    "/workout-templates",
  );
  const bodies = useFitnessQuery<Page<Body>>("/body-metrics", {
    page,
    limit: 20,
  });
  useEffect(() => setPage(1), [from, to, tab]);
  useEffect(() => {
    const total = tab === "body" ? bodies.data?.total : sessions.data?.total;
    if (total !== undefined && page > Math.max(1, Math.ceil(total / 20)))
      setPage(Math.max(1, Math.ceil(total / 20)));
  }, [tab, page, bodies.data?.total, sessions.data?.total]);
  const remove = useFitnessMutation(
    async () =>
      apiClient.delete(deleting!.path, {
        data:
          deleting!.revision !== undefined
            ? { revision: deleting!.revision }
            : undefined,
      }),
    () => {
      if (deleting?.path === "/workout-sessions/" + selected) setSelected(null);
      setDeleting(null);
      setConfirmed(false);
    },
  );
  const confirmDelete = (d: DeleteTarget) => {
    setDeleting(d);
    setConfirmed(false);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MỖI BUỔI TẬP, MỘT BƯỚC TIẾN</span>
          <h1>Tập luyện</h1>
          <p>Sổ tập riêng của bạn — ghi nhanh, nhìn lại và giữ nhịp.</p>
        </div>
        <Button onClick={() => setDialog({ kind: "session" })}>
          <Plus size={18} />
          Ghi buổi tập
        </Button>
      </div>
      <p className="account-note">
        Dữ liệu tập luyện và số đo chỉ bạn xem được, kể cả khi đã ghép đôi.
      </p>
      <div className="fitness-tabs" role="tablist" aria-label="Tập luyện">
        {[
          ["overview", "Tiến bộ"],
          ["sessions", "Buổi tập"],
          ["exercises", "Bài tập"],
          ["templates", "Mẫu buổi tập"],
          ["body", "Số đo"],
        ].map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {exercises.isError && <ErrorBox error={exercises.error} />}
      {tab === "overview" && (
        <>
          <Card>
            <div className="history-filters fitness-filters">
              <label>
                Khoảng thời gian
                <select
                  aria-label="Khoảng thời gian"
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value);
                    setFrom("");
                    setTo("");
                  }}
                >
                  <option value="7d">7 ngày</option>
                  <option value="30d">30 ngày</option>
                  <option value="90d">90 ngày</option>
                </select>
              </label>
              <label>
                Bài tập
                <select
                  aria-label="Lọc bài tập"
                  value={exerciseId}
                  onChange={(e) => setExerciseId(e.target.value)}
                >
                  <option value="">Tất cả bài</option>
                  {exercises.data?.items.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Từ ngày
                <input
                  aria-label="Từ ngày"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Đến ngày
                <input
                  aria-label="Đến ngày"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            <p className="muted">
              Số buổi/thời gian tính toàn bộ buổi; volume/rep theo bài đang
              chọn. Chỉ set đã hoàn thành được tính. Tuần bắt đầu thứ Hai.
            </p>
          </Card>
          {report.isPending ? (
            <Skeleton />
          ) : report.isError ? (
            <Card>
              <ErrorBox error={report.error} />
              <Button onClick={() => void report.refetch()}>Thử lại</Button>
            </Card>
          ) : (
            <Analytics
              report={report.data}
              exerciseSelected={!!exerciseId}
              onContinue={() => setDialog({ kind: "session" })}
              onGoal={() =>
                setDialog({
                  kind: "goal",
                  target: report.data.weeklyGoal.target,
                })
              }
            />
          )}
        </>
      )}
      {tab === "sessions" && (
        <>
          {selected && (
            <SessionDetail
              key={selected}
              id={selected}
              exercises={exercises.data?.items ?? []}
              onClose={() => setSelected(null)}
              onEdit={setDialog}
              onDelete={confirmDelete}
            />
          )}
          <Card>
            <div className="section-heading">
              <h2>Lịch sử buổi tập</h2>
            </div>
            <div className="history-filters">
              <label>
                Từ ngày
                <input
                  aria-label="Từ ngày"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label>
                Đến ngày
                <input
                  aria-label="Đến ngày"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
            {sessions.isPending ? (
              <Skeleton />
            ) : sessions.isError ? (
              <ErrorBox error={sessions.error} />
            ) : (
              <>
                {sessions.data.items.length ? (
                  sessions.data.items.map((w) => (
                    <article className="fitness-session" key={w.id}>
                      <div>
                        <h3>
                          {w.date} · {w.durationMinutes} phút
                        </h3>
                        <p>
                          {w.sets.length} set · Volume {fmt(w.volume)}
                          {w.mood ? ` · Cảm giác ${w.mood}/5` : ""}
                        </p>
                        <p>{w.notes}</p>
                      </div>
                      <div className="fitness-actions">
                        <Button onClick={() => setSelected(w.id)}>
                          Ghi / xem set
                        </Button>
                        <Button
                          className="button-outline"
                          onClick={() =>
                            setDialog({ kind: "session", session: w })
                          }
                        >
                          Sửa
                        </Button>
                        <Button
                          className="button-outline"
                          onClick={() =>
                            confirmDelete({
                              path: "/workout-sessions/" + w.id,
                              name: "Buổi tập " + w.date,
                              revision: w.revision,
                            })
                          }
                        >
                          Xóa
                        </Button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState title="Chưa ghi buổi tập">
                    Ghi ngày và thời gian, rồi thêm các set của bạn.
                  </EmptyState>
                )}
                <Pager
                  page={page}
                  total={sessions.data.total}
                  onPage={setPage}
                />
              </>
            )}
          </Card>
        </>
      )}
      {tab === "exercises" && (
        <Card>
          <div className="section-heading">
            <h2>Thư viện bài tập</h2>
            <Button onClick={() => setDialog({ kind: "exercise" })}>
              Thêm bài tập
            </Button>
          </div>
          {exercises.isPending ? (
            <Skeleton />
          ) : exercises.isError ? (
            <ErrorBox error={exercises.error} />
          ) : (
            exercises.data.items.map((e) => (
              <article className="fitness-session" key={e.id}>
                <div>
                  <b>{e.name}</b>
                  <p>
                    {e.muscleGroup} · {e.isSystem ? "Có sẵn" : "Bài của bạn"}
                  </p>
                </div>
                {!e.isSystem && (
                  <div className="fitness-actions">
                    <Button
                      className="button-outline"
                      onClick={() =>
                        setDialog({ kind: "exercise", exercise: e })
                      }
                    >
                      Sửa
                    </Button>
                    <Button
                      className="button-outline"
                      onClick={() =>
                        confirmDelete({
                          path: "/exercises/" + e.id,
                          name: e.name,
                        })
                      }
                    >
                      Xóa
                    </Button>
                  </div>
                )}
              </article>
            ))
          )}
        </Card>
      )}
      {tab === "templates" && (
        <Card>
          <div className="section-heading">
            <h2>Mẫu buổi tập</h2>
            <Button onClick={() => setDialog({ kind: "template" })}>
              Tạo mẫu
            </Button>
          </div>
          <p className="muted">
            Mẫu tạo buổi tập mới với các set chưa hoàn thành. Đánh dấu từng set
            sau khi tập.
          </p>
          {templates.isPending ? (
            <Skeleton />
          ) : templates.isError ? (
            <ErrorBox error={templates.error} />
          ) : templates.data.items.length ? (
            templates.data.items.map((t) => (
              <article className="fitness-session" key={t.id}>
                <div>
                  <h3>{t.name}</h3>
                  <p>
                    {t.items.length} set · {t.notes}
                  </p>
                </div>
                <div className="fitness-actions">
                  <Button
                    onClick={() =>
                      setDialog({ kind: "session", templateId: t.id })
                    }
                  >
                    Tập theo mẫu
                  </Button>
                  <Button
                    className="button-outline"
                    onClick={() => setDialog({ kind: "template", template: t })}
                  >
                    Sửa
                  </Button>
                  <Button
                    className="button-outline"
                    onClick={() =>
                      confirmDelete({
                        path: "/workout-templates/" + t.id,
                        name: t.name,
                        revision: t.revision,
                      })
                    }
                  >
                    Xóa
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Chưa có mẫu">
              Tạo Push/Pull/Legs hoặc lưu các set của buổi tập thành mẫu.
            </EmptyState>
          )}
        </Card>
      )}
      {tab === "body" && (
        <Card>
          <div className="section-heading">
            <h2>Nhật ký cân nặng & số đo</h2>
            <Button onClick={() => setDialog({ kind: "body" })}>
              Ghi số đo
            </Button>
          </div>
          {bodies.isPending ? (
            <Skeleton />
          ) : bodies.isError ? (
            <ErrorBox error={bodies.error} />
          ) : (
            <>
              {bodies.data.items.length ? (
                bodies.data.items.map((b) => (
                  <article className="fitness-session" key={b.id}>
                    <div>
                      <h3>{b.date}</h3>
                      <p>
                        {b.weight ? `${b.weight} kg · ` : ""}
                        {(
                          ["waist", "chest", "hips", "arm", "thigh"] as const
                        ).map((k, i) =>
                          b[k]
                            ? `${["Eo", "Ngực", "Hông", "Tay", "Đùi"][i]} ${b[k]} cm · `
                            : "",
                        )}
                      </p>
                      <p>{b.notes}</p>
                    </div>
                    <div className="fitness-actions">
                      <Button
                        className="button-outline"
                        onClick={() => setDialog({ kind: "body", body: b })}
                      >
                        Sửa
                      </Button>
                      <Button
                        className="button-outline"
                        onClick={() =>
                          confirmDelete({
                            path: "/body-metrics/" + b.id,
                            name: "Số đo " + b.date,
                            revision: b.revision,
                          })
                        }
                      >
                        Xóa
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Chưa có số đo">
                  Ghi cân nặng hoặc số đo theo ngày; xem biểu đồ tại Tiến bộ.
                </EmptyState>
              )}
              <Pager page={page} total={bodies.data.total} onPage={setPage} />
            </>
          )}
        </Card>
      )}
      {dialog && (
        <FitnessForm
          dialog={dialog}
          exercises={exercises.data?.items ?? []}
          onSession={(id) => {
            setTab("sessions");
            setSelected(id);
          }}
          onClose={() => setDialog(null)}
        />
      )}{" "}
      {deleting && (
        <Modal
          title="Xóa dữ liệu tập luyện"
          onClose={() => setDeleting(null)}
          busy={remove.isPending}
        >
          <p>
            Xóa {deleting.name}? Xóa buổi tập cũng xóa các set của buổi đó và
            tính lại thống kê/PR.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Tôi xác nhận xóa.
          </label>
          {remove.isError && <ErrorBox error={remove.error} />}
          <div className="modal-actions">
            <Button
              className="button-outline"
              onClick={() => setDeleting(null)}
            >
              Hủy
            </Button>
            <Button
              disabled={!confirmed || remove.isPending}
              onClick={() => remove.mutate()}
            >
              Xác nhận xóa
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function FitnessPreview() {
  const q = useFitnessQuery<Report>("/fitness/stats", { range: "7d" });
  return (
    <Card>
      <div className="section-heading">
        <h2>Nhịp tập luyện</h2>
        <Dumbbell size={23} />
      </div>
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          <p>
            {q.data.stats.weekSessions} buổi tuần này · Volume tuần{" "}
            {fmt(q.data.comparison.current.volume)}
          </p>
          {q.data.latest ? (
            <p>
              Gần nhất: {q.data.latest.date} · {q.data.latest.durationMinutes}{" "}
              phút · Volume {fmt(q.data.latest.volume)}
            </p>
          ) : (
            <p>Chưa có buổi tập. Ghi buổi đầu tiên để bắt đầu.</p>
          )}
          <Chart
            rows={q.data.volume}
            keys={[{ key: "volume", name: "Volume", color: "#7e9b57" }]}
          />
        </>
      )}
      <Link className="card-link" to="/fitness">
        Mở sổ tập luyện →
      </Link>
    </Card>
  );
}
