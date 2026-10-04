import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { Card, Skeleton } from "../../components/ui";
import { errorMessage } from "../../lib/apiClient";
import { Report } from "./types";
import { useFitnessQuery } from "./api";
import { Chart } from "./FitnessChart";
const fmt = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
function ErrorBox({ error }: { error: unknown }) {
  return <p role="alert">{errorMessage(error)}</p>;
}
export function FitnessPreview({ provided }: { provided?: Report }) {
  const q = useFitnessQuery<Report>(
    "/fitness/stats",
    { range: "7d" },
    !provided,
  );
  const data = provided ?? q.data;
  return (
    <Card>
      <div className="section-heading">
        <h2>Nhịp tập luyện</h2>
        <Dumbbell size={23} />
      </div>
      {!provided && q.isPending ? (
        <Skeleton />
      ) : !provided && q.isError ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          <p>
            {data!.stats.weekSessions} buổi tuần này · Volume tuần{" "}
            {fmt(data!.comparison.current.volume)}
          </p>
          {data!.latest ? (
            <p>
              Gần nhất: {data!.latest.date} · {data!.latest.durationMinutes}{" "}
              phút · Volume {fmt(data!.latest.volume)}
            </p>
          ) : (
            <p>Chưa có buổi tập. Ghi buổi đầu tiên để bắt đầu.</p>
          )}
          <Chart
            rows={data!.volume}
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
