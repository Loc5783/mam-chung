import { Link } from "react-router-dom";
import {
  Wallet,
  Heart,
  CheckSquare,
  Dumbbell,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "../auth/store";
import { Card, EmptyState } from "../../components/ui";
export function AccountHome() {
  const user = useAuthStore((s) => s.user)!;
  const date = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "full",
    timeZone: user.timezone,
  }).format(new Date());
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{date.toUpperCase()}</span>
          <h1>Chào {user.name}, mừng bạn trở lại 🌱</h1>
          <p>Không gian riêng của bạn đã sẵn sàng.</p>
        </div>
        <Link className="button" to="/settings">
          Chăm chút hồ sơ <ArrowRight size={17} />
        </Link>
      </div>
      <div className="account-note">
        <ShieldCheck size={20} />
        <span>
          Tài khoản đã được kết nối. Các công cụ tài chính, cặp đôi, công việc
          và tập luyện sẽ được mở theo từng giai đoạn.
        </span>
      </div>
      <div className="account-grid">
        {[
          {
            title: "Tài chính cá nhân",
            icon: Wallet,
            to: "/finance",
            description: "Ví, thu chi và những mục tiêu tiết kiệm của bạn.",
          },
          {
            title: "Không gian chung",
            icon: Heart,
            to: "/couple",
            description: "Cùng người thương vun đắp một hành trình.",
          },
          {
            title: "Công việc",
            icon: CheckSquare,
            to: "/tasks",
            description: "Sắp xếp từng việc nhỏ cho một ngày nhẹ nhàng.",
          },
          {
            title: "Tập luyện",
            icon: Dumbbell,
            to: "/fitness",
            description: "Ghi nhận mỗi bước tiến của sức khỏe.",
          },
        ].map(({ title, icon: Icon, to, description }) => (
          <Card key={to}>
            <div className="section-heading">
              <h2>{title}</h2>
              <Icon size={24} />
            </div>
            <EmptyState title="Sắp được vun đắp">{description}</EmptyState>
            <Link className="card-link" to={to}>
              Xem trạng thái <ArrowRight size={16} />
            </Link>
          </Card>
        ))}
      </div>
      <p className="account-preview-link">
        Muốn xem trước thiết kế tổng quan?{" "}
        <Link to="/preview">Mở giao diện minh họa</Link>
      </p>
    </>
  );
}
