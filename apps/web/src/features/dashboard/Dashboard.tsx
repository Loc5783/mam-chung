import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Heart,
  Sprout,
  Wallet,
  Dumbbell,
  Check,
  Plus,
  CalendarDays,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui";
import { formatMoney } from "../../lib/format";
import { CountUp } from "../../lib/motion";
const expenses = [
  ["Ăn uống", 38],
  ["Mua sắm", 27],
  ["Di chuyển", 20],
  ["Khác", 15],
] as const;
export function Dashboard() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KHÔNG GIAN CỦA BẠN</span>
          <h1>
            Một ngày tốt lành, bạn nhé{" "}
            <span className="greeting-sprout">✳</span>
          </h1>
          <p>Cùng chăm chút cho những điều quan trọng.</p>
        </div>
        <Link to="/login" className="button button-sheen">
          <Plus size={17} /> Bắt đầu hành trình
        </Link>
      </div>
      <div className="demo-banner">
        <Sprout size={18} />
        <span>
          <b>Bản xem trước · Giai đoạn 0.</b> Các số liệu bên dưới là dữ liệu
          minh họa, chưa phải tài khoản thật.
        </span>
        <Link to="/register">
          Tạo tài khoản mẫu <ChevronRight size={15} />
        </Link>
      </div>
      <div className="summary-grid">
        <Card className="balance-card">
          <div className="stat-label">
            Tổng số dư cá nhân <Wallet size={19} />
          </div>
          <strong>
            <CountUp value={24500000} format={formatMoney} />
          </strong>
          <span className="stat-foot">
            Trong 3 ví của bạn <span>↗</span>
          </span>
          <div className="balance-decoration" aria-hidden="true">
            <Sprout />
          </div>
        </Card>
        <Card>
          <div className="stat-label">
            Thu nhập tháng này{" "}
            <span className="mini-icon">
              <ArrowDownLeft size={18} />
            </span>
          </div>
          <strong>
            <CountUp value={15000000} format={formatMoney} />
          </strong>
          <span className="stat-foot">
            <span className="pill">+12,5%</span> so với tháng trước
          </span>
        </Card>
        <Card>
          <div className="stat-label">
            Chi tiêu tháng này{" "}
            <span className="mini-icon pink">
              <ArrowUpRight size={18} />
            </span>
          </div>
          <strong>
            <CountUp value={6250000} format={formatMoney} />
          </strong>
          <span className="stat-foot">
            <span className="pill pink">−8,2%</span> so với tháng trước
          </span>
        </Card>
      </div>
      <div className="dashboard-grid">
        <Card className="spending-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TÀI CHÍNH CÁ NHÂN</span>
              <h2>Chi tiêu của bạn</h2>
            </div>
            <span className="subtle-chip">Tháng mẫu</span>
          </div>
          <div className="spending-content">
            <div
              className="donut"
              role="img"
              aria-label="Chi tiêu mẫu: ăn uống 38%, mua sắm 27%, di chuyển 20%, khác 15%"
            >
              <div>
                <small>Tổng chi tiêu</small>
                <b>6.250.000</b>
                <small>đồng</small>
              </div>
            </div>
            <div className="legend">
              {expenses.map(([name, value], i) => (
                <div key={name}>
                  <span className={`legend-dot dot-${i}`} />
                  <span>{name}</span>
                  <b>{value}%</b>
                </div>
              ))}
            </div>
          </div>
          <div className="budget-summary">
            <div>
              <span>Ngân sách ăn uống</span>
              <b>75%</b>
            </div>
            <div className="progress">
              <span style={{ width: "75%" }} />
            </div>
            <small>2.250.000 / 3.000.000 đ · Vẫn trong kế hoạch</small>
          </div>
        </Card>
        <Card className="couple-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">KHÔNG GIAN CHUNG</span>
              <h2>Mình cùng nhau</h2>
            </div>
            <Heart size={22} className="motion-heart-beat" />
          </div>
          <div className="couple-avatars">
            <span>M</span>
            <Heart size={18} className="motion-heart-beat" />
            <span>L</span>
          </div>
          <h3>Minh & Lan</h3>
          <p>Mỗi ngày bên nhau, thêm một chút lớn lên.</p>
          <div className="together-days">
            <b className="tabular-nums">
              <CountUp value={365} />
            </b>
            <span>ngày cùng nhau</span>
          </div>
          <div className="couple-foot">
            <span>
              Quỹ chung <b>8.000.000 đ</b>
            </span>
            <span>
              Công nợ <b>Đã cân bằng ♡</b>
            </span>
          </div>
        </Card>
        <Card className="tasks-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TỪNG VIỆC NHỎ</span>
              <h2>Hôm nay cần làm</h2>
            </div>
            <Link to="/tasks" aria-label="Xem công việc">
              <ChevronRight size={20} />
            </Link>
          </div>
          <div
            className="task-row stagger-item"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <span className="task-check" />
            <div>
              <b>Đi chợ cho bữa tối</b>
              <small>
                <Heart size={12} /> Công việc chung · 17:30
              </small>
            </div>
            <span className="pill pink">Vừa</span>
          </div>
          <div
            className="task-row stagger-item"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <span className="task-check" />
            <div>
              <b>Hoàn thành báo cáo tuần</b>
              <small>
                <CalendarDays size={12} /> Cá nhân · 15:00
              </small>
            </div>
            <span className="pill">Cao</span>
          </div>
          <div
            className="task-row completed stagger-item"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            <span className="task-check checked">
              <Check size={14} />
            </span>
            <div>
              <b>Uống đủ nước</b>
              <small>Cá nhân · Đã hoàn thành</small>
            </div>
          </div>
          <Link to="/tasks" className="card-link">
            Xem tất cả công việc <ChevronRight size={16} />
          </Link>
        </Card>
        <Card className="fitness-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CHĂM SÓC BẢN THÂN</span>
              <h2>Mỗi ngày khỏe hơn</h2>
            </div>
            <Dumbbell size={23} />
          </div>
          <div className="fitness-stats">
            <div>
              <b>
                3<span>/4</span>
              </b>
              <small>buổi tập tuần này</small>
            </div>
            <div>
              <b>8.450</b>
              <small>kg tổng volume</small>
            </div>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label="Biểu đồ mẫu volume 7 ngày"
          >
            <div style={{ height: "45%" }} />
            <div style={{ height: "70%" }} />
            <div style={{ height: "32%" }} />
            <div style={{ height: "85%" }} />
            <div style={{ height: "50%" }} />
            <div style={{ height: "100%" }} />
            <div style={{ height: "15%" }} />
          </div>
          <div className="chart-days">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="workout-foot">
            <span className="mini-icon">
              <Dumbbell size={18} />
            </span>
            <div>
              <b>Buổi tập gần nhất · Push day</b>
              <small>55 phút · 6 bài tập</small>
            </div>
            <Link to="/fitness" aria-label="Xem tập luyện">
              <ChevronRight size={18} />
            </Link>
          </div>
        </Card>
      </div>
      <div className="dashboard-bottom">
        <Sprout size={18} />
        <p>Không cần hoàn hảo. Chỉ cần cùng nhau tiến lên một chút mỗi ngày.</p>
      </div>
    </>
  );
}
