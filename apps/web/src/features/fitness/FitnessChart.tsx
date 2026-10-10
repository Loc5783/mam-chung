import { EmptyState } from "../../components/ui";
import { AnimatedLine } from "../../components/charts";

export function Chart({
  rows,
  keys,
}: {
  rows: Record<string, unknown>[];
  keys: { key: string; name: string; color: string }[];
}) {
  return rows.length ? (
    <div className="fitness-chart">
      <AnimatedLine
        data={rows}
        lines={keys}
        xAxisKey="date"
        height={260}
        ariaLabel="Biểu đồ tiến trình tập luyện"
      />
    </div>
  ) : (
    <EmptyState title="Chưa có dữ liệu">
      Ghi lại buổi tập hoặc số đo để xem tiến trình.
    </EmptyState>
  );
}
