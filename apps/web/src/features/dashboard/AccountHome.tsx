import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FitnessPreview } from "../fitness/FitnessPreview";
import { TasksPreview } from "../tasks/TasksPreview";
import { FinanceOverview } from "../finance/FinanceOverview";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Heart, Plus } from "lucide-react";
import { useAuthStore } from "../auth/store";
import { Card, Button, Skeleton } from "../../components/ui";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { formatMoney } from "../../lib/format";
import { HomeData } from "./types";
export function AccountHome() {
  const navigate = useNavigate(),
    user = useAuthStore((s) => s.user)!;
  const q = useQuery({
    queryKey: ["dashboard", user.id],
    queryFn: async () => (await apiClient.get<HomeData>("/dashboard")).data,
    refetchInterval: 15000,
  });
  useEffect(() => {
    const current = useAuthStore.getState().user;
    if (current?.id === user.id && q.data) {
      const cid = q.data.couple?.id ?? null;
      if (current.coupleId !== cid)
        useAuthStore.getState().updateUser({ ...current, coupleId: cid });
    }
  }, [q.data, user.id]);
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
          <p>Một góc nhìn cho tiền bạc, công việc và nhịp tập của bạn.</p>
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
      <div className="home-quick-actions" aria-label="Hành động nhanh">
        <Link
          className="button button-sheen"
          to="/finance?tab=transactions&add=1"
        >
          <Plus size={17} />
          Giao dịch
        </Link>
        <Link
          className="button button-outline"
          to={q.data?.couple ? "/shared?tab=transactions&add=1" : "/couple"}
        >
          <Plus size={17} />
          Chi tiêu chung
        </Link>
        <Link className="button button-outline" to="/tasks?add=1">
          <Plus size={17} />
          Việc cần làm
        </Link>
        <Link className="button button-outline" to="/fitness?add=1">
          <Plus size={17} />
          Buổi tập
        </Link>
      </div>
      {q.isPending ? (
        <div className="finance-loading">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : q.isError ? (
        <Card>
          <h2>Chưa tải được tổng quan</h2>
          <p role="alert">{errorMessage(q.error)}</p>
          <Button onClick={() => void q.refetch()}>Thử lại</Button>
        </Card>
      ) : (
        <>
          <FinanceOverview
            overview={q.data.finance}
            budgets={q.data.budgets.items}
            onAdd={() => navigate("/finance?tab=transactions&add=1")}
            onWallet={() => navigate("/finance?tab=wallets&add=1")}
          />
          <div className="home-overview-grid">
            <TasksPreview provided={q.data.tasks} />
            <FitnessPreview provided={q.data.fitness} />
          </div>
          <Card className="couple-dashboard">
            <div className="section-heading">
              <h2>Hành trình chúng mình</h2>
              <Heart size={22} className="motion-heart-beat" />
            </div>
            {q.data.couple ? (
              <>
                <h3>{q.data.couple.name}</h3>
                <p>{q.data.couple.members.map((m) => m.name).join(" & ")}</p>
                {q.data.couple.anniversaryInfo && (
                  <p>
                    {q.data.couple.anniversaryInfo.daysTogether.toLocaleString(
                      "vi-VN",
                    )}{" "}
                    ngày bên nhau ·{" "}
                    {q.data.couple.anniversaryInfo.isToday
                      ? "Hôm nay là ngày kỷ niệm ♡"
                      : `Còn ${q.data.couple.anniversaryInfo.daysUntil} ngày đến kỷ niệm`}
                  </p>
                )}
                {q.data.shared && (
                  <div className="home-shared-summary">
                    <p>
                      Số dư quỹ:{" "}
                      <b>{formatMoney(q.data.shared.totalBalance)}</b>
                    </p>
                    <p>
                      {q.data.shared.summary.amount
                        ? `${q.data.shared.summary.fromName} cần hoàn ${formatMoney(q.data.shared.summary.amount)} cho ${q.data.shared.summary.toName}`
                        : "Công nợ ròng đã cân bằng"}
                    </p>
                    <p className="muted">
                      {q.data.shared.summary.outstandingCount} khoản chưa hoàn
                      tất · {q.data.shared.summary.pendingConfirmation} chờ xác
                      nhận. Mỗi khoản vẫn cần xử lý riêng.
                    </p>
                    <Link className="card-link" to="/shared?tab=settlements">
                      Mở quỹ và công nợ →
                    </Link>
                  </div>
                )}
                <h3>Hoạt động gần đây</h3>
                {q.data.activity?.items.length ? (
                  <div className="home-activity">
                    {q.data.activity.items.map((a) => (
                      <div key={a.id}>
                        <p>{a.message}</p>
                        <small>
                          {new Intl.DateTimeFormat("vi-VN", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: user.timezone,
                          }).format(new Date(a.createdAt))}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Chưa có hoạt động chung.</p>
                )}
              </>
            ) : (
              <p>Cùng người thương bắt đầu một hành trình chung.</p>
            )}
            <Link className="card-link" to="/couple">
              Mở không gian chung <ArrowRight size={16} />
            </Link>
          </Card>
          <p className="muted">
            Cập nhật lúc{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: user.timezone,
            }).format(new Date(q.data.generatedAt))}{" "}
            · Tự làm mới khi bạn quay lại trang.
          </p>
        </>
      )}
      <p className="account-preview-link">
        Muốn xem trước thiết kế tổng quan?{" "}
        <Link to="/preview">Mở giao diện minh họa</Link>
      </p>
    </>
  );
}
