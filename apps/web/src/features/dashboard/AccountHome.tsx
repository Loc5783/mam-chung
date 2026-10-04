import { FitnessPreview } from "../fitness/FitnessPage";
import { TasksPreview } from "../tasks/TasksPage";
import { SharedPreview } from "../shared/SharedFinancePage";
import { CouplePreview } from "../couples/CouplePage";
import { FinanceOverview } from "../finance/FinanceOverview";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useAuthStore } from "../auth/store";
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
          Tài chính, công việc và sổ tập luyện đã sẵn sàng. Dữ liệu riêng chỉ
          bạn xem được.
        </span>
      </div>
      <FinanceOverview
        onAdd={() => navigate("/finance?tab=transactions&add=1")}
        onWallet={() => navigate("/finance?tab=wallets&add=1")}
      />
      <CouplePreview />
      <SharedPreview />
      <TasksPreview />
      <FitnessPreview />
      <p className="account-preview-link">
        Muốn xem trước thiết kế tổng quan?{" "}
        <Link to="/preview">Mở giao diện minh họa</Link>
      </p>
    </>
  );
}
