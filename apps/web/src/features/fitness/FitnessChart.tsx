import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { EmptyState } from "../../components/ui";
export function Chart({
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
