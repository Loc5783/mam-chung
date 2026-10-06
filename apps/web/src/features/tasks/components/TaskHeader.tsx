import { Sprout } from "lucide-react";
export function TaskHeader({
  name,
  timezone,
  counts,
}: {
  name: string;
  timezone: string;
  counts?: Record<string, number>;
}) {
  const total = counts?.todayTotal,
    done = counts?.todayDone,
    percent = total ? Math.round(((done ?? 0) / total) * 100) : 0;
  return (
    <div className="todo-welcome">
      <div>
        <span className="eyebrow">TỪNG VIỆC NHỎ, MỖI NGÀY</span>
        <h1>Công việc</h1>
        <p>Chào {name.split(" ").at(-1)}, cùng gieo một ngày nhẹ nhàng.</p>
        <small>
          {new Date().toLocaleDateString("vi-VN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: timezone,
          })}
        </small>
      </div>
      <div className="todo-progress">
        <svg
          viewBox="0 0 64 64"
          role="img"
          aria-label={
            total === undefined
              ? "Đang tải tiến độ hôm nay"
              : `Hôm nay hoàn thành ${done}/${total} việc`
          }
        >
          <circle cx="32" cy="32" r="27" />
          <circle
            className="todo-progress-fill"
            cx="32"
            cy="32"
            r="27"
            strokeDasharray={`${percent * 1.696} 169.6`}
          />
          <text x="32" y="36" textAnchor="middle">
            {total === undefined ? "—" : `${done}/${total}`}
          </text>
        </svg>
        <span>
          {total !== undefined && total > 0 && done === total ? (
            <>
              <Sprout size={16} />
              Hôm nay xong hết rồi 🌱
            </>
          ) : (
            "Mỗi việc nhỏ đều đáng ghi nhận."
          )}
        </span>
      </div>
    </div>
  );
}
