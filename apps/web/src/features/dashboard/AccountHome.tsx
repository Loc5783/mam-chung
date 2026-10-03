import { SharedPreview } from "../shared/SharedFinancePage";
import { CouplePreview } from "../couples/CouplePage";
import { FinanceOverview } from "../finance/FinanceOverview";
import { Link, useNavigate } from "react-router-dom";
import { CheckSquare, Dumbbell, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../auth/store";
import { Card, EmptyState } from "../../components/ui";
export function AccountHome() {
  const navigate = useNavigate();
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
          Tài chính cá nhân và không gian chung đã sẵn sàng. Công việc và tập
          luyện sẽ được mở ở các giai đoạn tiếp theo.
        </span>
      </div>
      <FinanceOverview
        onAdd={() => navigate("/finance?tab=transactions&add=1")}
        onWallet={() => navigate("/finance?tab=wallets&add=1")}
      />
      <CouplePreview />
      <SharedPreview />
      <div className="account-grid">
        {[
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
