import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  Plus,
  Copy,
  CalendarHeart,
  History,
  ArrowRight,
} from "lucide-react";
import { Button, Card, Skeleton } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
import { apiClient, errorMessage } from "../../lib/apiClient";
import { useUiStore } from "../../app/store";
import { useAuthStore } from "../auth/store";
import { useCouple, useCoupleQuery, useCoupleMutation } from "./api";
import { CoupleData, InviteData, Activity } from "./types";
function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <p className="form-error" role="alert">
      {errorMessage(error)}
    </p>
  ) : null;
}
function InfoForm({
  couple,
  onClose,
}: {
  couple?: CoupleData;
  onClose: () => void;
}) {
  const [name, setName] = useState(couple?.name ?? "Hành trình của chúng mình"),
    [anniversary, setDate] = useState(couple?.anniversary ?? "");
  const save = useCoupleMutation(
    () =>
      couple
        ? apiClient.put("/couples/me", {
            name,
            anniversary: anniversary || null,
          })
        : apiClient.post("/couples", {
            name,
            anniversary: anniversary || null,
          }),
    "Đã lưu không gian chung.",
    onClose,
  );
  return (
    <Modal
      title={couple ? "Chăm chút hành trình" : "Bắt đầu cùng nhau"}
      onClose={onClose}
      busy={save.isPending}
    >
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          Tên không gian chung
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
            disabled={save.isPending}
          />
        </label>
        <label>
          Ngày bắt đầu bên nhau
          <input
            type="date"
            aria-label="Ngày bắt đầu bên nhau"
            value={anniversary}
            min="1900-01-01"
            onChange={(e) => setDate(e.target.value)}
            disabled={save.isPending}
          />
          <small>Có thể để trống và bổ sung sau.</small>
        </label>
        <ErrorBox error={save.error} />
        <div className="modal-actions">
          <Button
            className="button-outline"
            onClick={onClose}
            disabled={save.isPending}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={!name.trim() || save.isPending}>
            {save.isPending ? "Đang lưu…" : "Lưu hành trình"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function CodeForm() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className="couple-code-form"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(`/invite/${code.trim().toUpperCase()}`);
      }}
    >
      <label>
        Mã mời của người thương
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          pattern="[A-HJ-NP-Z2-9]{8}"
          required
          placeholder="8 ký tự"
          autoComplete="off"
        />
      </label>
      <Button type="submit" disabled={code.trim().length !== 8}>
        Xem lời mời <ArrowRight size={16} />
      </Button>
    </form>
  );
}
function LeaveForm({
  couple,
  onClose,
}: {
  couple: CoupleData;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false),
    [debt, setDebt] = useState(false);
  const leave = useCoupleMutation(
    () =>
      apiClient.delete("/couples/leave", {
        data: {
          confirm: true,
          dissolve: couple.role === "owner",
          confirmOutstanding: debt,
        },
      }),
    "Hành trình đã được lưu trữ; cả hai vẫn xem được lịch sử.",
    onClose,
  );
  return (
    <Modal
      title={
        couple.role === "owner"
          ? "Giải tán và lưu trữ"
          : "Rời và lưu trữ hành trình"
      }
      onClose={onClose}
      busy={leave.isPending}
    >
      <p>
        Không gian chung sẽ được lưu trữ cho cả hai, chỉ xem lịch sử. Cả hai có
        thể bắt đầu một không gian mới. Thông tin tài chính cá nhân được giữ
        nguyên.
      </p>
      {couple.outstanding.count > 0 && (
        <p className="form-error">
          Còn {couple.outstanding.count} khoản công nợ chưa thanh toán. Lưu trữ
          không xóa nghĩa vụ thanh toán.
        </p>
      )}
      <div className="settings-form">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          Tôi hiểu và xác nhận lưu trữ không gian chung.
        </label>
        {couple.outstanding.count > 0 && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={debt}
              onChange={(e) => setDebt(e.target.checked)}
            />
            Tôi xác nhận vẫn lưu trữ khi còn công nợ.
          </label>
        )}
        <ErrorBox error={leave.error} />
        <div className="modal-actions">
          <Button
            className="button-outline"
            onClick={onClose}
            disabled={leave.isPending}
          >
            Hủy
          </Button>
          <Button
            disabled={
              !confirm ||
              (couple.outstanding.count > 0 && !debt) ||
              leave.isPending
            }
            onClick={() => leave.mutate()}
          >
            {leave.isPending ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
function TransferForm({
  couple,
  onClose,
}: {
  couple: CoupleData;
  onClose: () => void;
}) {
  const other = couple.members.find(
    (m) => m.userId !== couple.ownerId && m.active,
  )!;
  const transfer = useCoupleMutation(
    () => apiClient.post("/couples/transfer-owner", { userId: other.userId }),
    "Đã chuyển quyền chủ không gian.",
    onClose,
  );
  return (
    <Modal
      title="Chuyển quyền chủ không gian"
      onClose={onClose}
      busy={transfer.isPending}
    >
      <p>
        Bạn chuyển quyền tạo/thu hồi mã mời cho <b>{other.name}</b>. Sau đó bạn
        là thành viên và có thể rời.
      </p>
      <ErrorBox error={transfer.error} />
      <div className="modal-actions">
        <Button className="button-outline" onClick={onClose}>
          Hủy
        </Button>
        <Button disabled={transfer.isPending} onClick={() => transfer.mutate()}>
          Chuyển quyền
        </Button>
      </div>
    </Modal>
  );
}
function Feed({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useCoupleQuery<{
    items: Activity[];
    total: number;
    page: number;
    limit: number;
  }>("activity", "/couples/activity", { coupleId: id, page, limit: 10 }, true);
  return (
    <Card className="couple-feed">
      <div className="section-heading">
        <h2>Những bước nhỏ cùng nhau</h2>
        <History size={22} />
      </div>
      {q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          <ol className="activity-list">
            {q.data.items.map((a) => (
              <li key={a.id}>
                <span className="activity-dot" />
                <div>
                  <p>{a.message}</p>
                  <time dateTime={a.createdAt}>
                    {new Date(a.createdAt).toLocaleString("vi-VN")}
                  </time>
                </div>
              </li>
            ))}
          </ol>
          {!q.data.items.length && (
            <p className="muted">Chưa có hoạt động nào.</p>
          )}
          <div className="pagination">
            <span>
              {q.data.total} hoạt động · Trang {page}
            </span>
            <Button
              className="button-outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Trước
            </Button>
            <Button
              className="button-outline"
              disabled={page * 10 >= q.data.total}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
function CoupleView({ couple }: { couple: CoupleData }) {
  const [edit, setEdit] = useState(false),
    [leave, setLeave] = useState(false),
    [transfer, setTransfer] = useState(false),
    [generated, setGenerated] = useState<InviteData | null>(null),
    [revokeConfirm, setRevoke] = useState(false);
  const seenInvite = useRef<string | null>(null);
  const notify = useUiStore((s) => s.notify);
  const archived = couple.status === "archived";
  const invite = useCoupleMutation(
    async () => (await apiClient.post<InviteData>("/couples/invite", {})).data,
    "Mã mời mới có hiệu lực trong 48 giờ.",
    setGenerated,
  );
  const revoke = useCoupleMutation(
    () => apiClient.delete("/couples/invite", { data: {} }),
    "Đã thu hồi mã mời.",
    () => {
      setGenerated(null);
      setRevoke(false);
    },
  );
  useEffect(() => {
    if (!generated) {
      seenInvite.current = null;
      return;
    }
    if (couple.invite?.id === generated.id) seenInvite.current = generated.id;
    else if (seenInvite.current === generated.id) setGenerated(null);
    if (Date.parse(generated.expiresAt) <= Date.now()) setGenerated(null);
  }, [couple.invite?.id, generated]);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify("Đã sao chép. Bạn có thể gửi cho người thương.");
    } catch {
      notify("Chưa sao chép được. Hãy chọn và sao chép mã hiển thị.");
    }
  };
  return (
    <>
      <Card className="couple-hero">
        <span className="eyebrow">
          {archived ? "HÀNH TRÌNH ĐÃ LƯU TRỮ" : "CHÚNG MÌNH, TỪNG NGÀY"}
        </span>
        <h2>{couple.name}</h2>
        {archived && (
          <p className="couple-archive-note">
            Chỉ đọc · Lưu trữ{" "}
            {new Date(couple.archivedAt!).toLocaleDateString("vi-VN")}. Lịch sử
            thuộc hành trình này được giữ cho cả hai.
          </p>
        )}
        <div className="couple-members">
          {couple.members.map((m) => (
            <div className="couple-person" key={m.userId}>
              <span className="couple-avatar">
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt={m.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.hidden = true;
                    }}
                  />
                ) : (
                  m.name.charAt(0).toUpperCase()
                )}
              </span>
              <b>{m.name}</b>
              <small>
                {m.role === "owner" ? "Chủ không gian" : "Thành viên"}
              </small>
            </div>
          ))}
          {couple.members.length === 1 && !archived && (
            <div className="couple-person waiting">
              <span className="couple-avatar">
                <Heart />
              </span>
              <b>Chờ người thương</b>
              <small>Ghép đôi bằng mã mời</small>
            </div>
          )}
        </div>
        {couple.anniversaryInfo ? (
          <div className="anniversary-box">
            <CalendarHeart />
            <div>
              <b>
                {couple.anniversaryInfo.daysTogether.toLocaleString("vi-VN")}{" "}
                ngày bên nhau
              </b>
              <p>
                Từ{" "}
                {new Date(couple.anniversary + "T12:00:00").toLocaleDateString(
                  "vi-VN",
                )}
              </p>
              <p>
                {couple.anniversaryInfo.isToday
                  ? "Hôm nay là ngày kỷ niệm của chúng mình ♡"
                  : `Còn ${couple.anniversaryInfo.daysUntil} ngày đến kỷ niệm tiếp theo`}
              </p>
            </div>
          </div>
        ) : (
          <p className="muted">
            Thêm ngày bắt đầu để cùng đếm những ngày bên nhau.
          </p>
        )}
        {!archived && (
          <Button className="button-outline" onClick={() => setEdit(true)}>
            Sửa thông tin & ngày kỷ niệm
          </Button>
        )}
      </Card>
      <div className="couple-two-column">
        {!archived &&
          couple.role === "owner" &&
          couple.members.length === 1 && (
            <Card>
              <div className="section-heading">
                <h2>Mời người thương</h2>
                <Heart size={22} />
              </div>
              <p>
                Mã dùng một lần, hết hạn sau 48 giờ. Tạo mã mới sẽ thu hồi mã
                cũ.
              </p>
              {generated ? (
                <div className="invite-code-box">
                  <strong>{generated.code}</strong>
                  <p>
                    Hết hạn{" "}
                    {new Date(generated.expiresAt).toLocaleString("vi-VN")}
                  </p>
                  <div className="couple-actions">
                    <Button onClick={() => void copy(generated.code)}>
                      <Copy size={16} />
                      Sao chép mã
                    </Button>
                    <Button
                      className="button-outline"
                      onClick={() =>
                        void copy(window.location.origin + generated.path)
                      }
                    >
                      Sao chép liên kết
                    </Button>
                  </div>
                </div>
              ) : (
                couple.invite && (
                  <p className="muted">
                    Đang có mã mời đến{" "}
                    {new Date(couple.invite.expiresAt).toLocaleString("vi-VN")}.
                    Mã chỉ hiển thị lúc tạo; nếu chưa lưu, bạn có thể tạo mã
                    mới.
                  </p>
                )
              )}
              <ErrorBox error={invite.error} />
              <div className="couple-actions">
                <Button
                  disabled={invite.isPending}
                  onClick={() => invite.mutate()}
                >
                  {couple.invite ? "Tạo mã mới" : "Tạo mã mời"}
                </Button>
                {couple.invite && (
                  <Button
                    className="button-outline"
                    onClick={() => setRevoke(true)}
                  >
                    Thu hồi mã
                  </Button>
                )}
              </div>
            </Card>
          )}
        <Card>
          <h2>Công nợ chung</h2>
          <Link
            className="card-link"
            to={archived ? `/shared?coupleId=${couple.id}` : "/shared"}
          >
            Xem quỹ & công nợ →
          </Link>
          <p className="muted">
            Quỹ chung, phần chia và lịch sử hoàn tiền được ghi rõ cho cả hai.
          </p>
          {couple.outstanding.count > 0 && (
            <p className="form-error">
              Có {couple.outstanding.count} khoản công nợ chưa thanh toán được
              lưu trong hành trình này.
            </p>
          )}
        </Card>
      </div>
      <Feed key={couple.id} id={couple.id} />
      {!archived && (
        <Card>
          <h2>Quản lý hành trình</h2>
          {couple.role === "owner" && couple.members.length > 1 ? (
            <>
              <p>
                Chuyển quyền cho người còn lại trước khi rời. Khi một người rời,
                hành trình chung được lưu trữ cho cả hai.
              </p>
              <Button
                className="button-outline"
                onClick={() => setTransfer(true)}
              >
                Chuyển quyền chủ không gian
              </Button>
            </>
          ) : (
            <>
              <p>
                {couple.role === "owner"
                  ? "Bạn đang là người duy nhất. Giải tán sẽ lưu trữ lịch sử để xem lại."
                  : "Rời sẽ lưu trữ toàn bộ hành trình chung cho cả hai; không xóa dữ liệu."}
              </p>
              <Button className="button-outline" onClick={() => setLeave(true)}>
                {couple.role === "owner"
                  ? "Giải tán không gian chung"
                  : "Rời không gian chung"}
              </Button>
            </>
          )}
        </Card>
      )}
      {edit && <InfoForm couple={couple} onClose={() => setEdit(false)} />}
      {leave && <LeaveForm couple={couple} onClose={() => setLeave(false)} />}
      {transfer && (
        <TransferForm couple={couple} onClose={() => setTransfer(false)} />
      )}
      {revokeConfirm && (
        <Modal
          title="Thu hồi mã mời"
          onClose={() => setRevoke(false)}
          busy={revoke.isPending}
        >
          <p>Mã mời hiện tại sẽ không còn dùng để ghép đôi được.</p>
          <ErrorBox error={revoke.error} />
          <div className="modal-actions">
            <Button className="button-outline" onClick={() => setRevoke(false)}>
              Hủy
            </Button>
            <Button disabled={revoke.isPending} onClick={() => revoke.mutate()}>
              Xác nhận thu hồi
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function CouplePage() {
  const q = useCouple(),
    [create, setCreate] = useState(false),
    [archived, setArchived] = useState<CoupleData | null>(null),
    [page, setPage] = useState(1);
  const archives = useCoupleQuery<{ items: CoupleData[]; total: number }>(
    "archives",
    "/couples/archives",
    { page, limit: 10 },
    true,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CÙNG NHAU LỚN LÊN</span>
          <h1>Không gian chung</h1>
          <Link className="card-link" to="/shared">
            Quỹ chung & công nợ →
          </Link>
          <p>Một hành trình, hai người cùng vun đắp.</p>
        </div>
      </div>
      {archived ? (
        <>
          <Button className="button-outline" onClick={() => setArchived(null)}>
            ← Trở lại hành trình hiện tại
          </Button>
          <CoupleView key={archived.id} couple={archived} />
        </>
      ) : q.isPending ? (
        <Skeleton />
      ) : q.isError ? (
        <>
          <ErrorBox error={q.error} />
          <Button onClick={() => void q.refetch()}>Thử lại</Button>
        </>
      ) : q.data.couple ? (
        <CoupleView key={q.data.couple.id} couple={q.data.couple} />
      ) : (
        <div className="couple-two-column">
          <Card>
            <Heart className="couple-heart" size={42} />
            <h2>Một chỗ dành cho chúng mình</h2>
            <p>
              Tạo hành trình và gửi mã mời, hoặc dùng mã của người thương để
              cùng bắt đầu. Mỗi người có một không gian chung đang hoạt động.
            </p>
            <Button onClick={() => setCreate(true)}>
              <Plus size={16} />
              Tạo không gian chung
            </Button>
          </Card>
          <Card>
            <h2>Bạn đã có lời mời?</h2>
            <CodeForm />
          </Card>
        </div>
      )}
      {!archived && (
        <Card className="couple-archives">
          <div className="section-heading">
            <h2>Những hành trình đã lưu trữ</h2>
            <History size={22} />
          </div>
          {archives.isPending ? (
            <Skeleton />
          ) : archives.isError ? (
            <ErrorBox error={archives.error} />
          ) : archives.data.items.length ? (
            <>
              <div className="archive-list">
                {archives.data.items.map((c) => (
                  <button key={c.id} onClick={() => setArchived(c)}>
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.members.map((m) => m.name).join(" & ")} · Chỉ đọc
                      </small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
              <div className="pagination">
                <Button
                  className="button-outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Trước
                </Button>
                <Button
                  className="button-outline"
                  disabled={page * 10 >= archives.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Sau
                </Button>
              </div>
            </>
          ) : (
            <p className="muted">Chưa có hành trình được lưu trữ.</p>
          )}
        </Card>
      )}
      {create && <InfoForm onClose={() => setCreate(false)} />}
    </>
  );
}
export function InvitePage() {
  useCouple();
  const { code = "" } = useParams();
  const user = useAuthStore((s) => s.user)!;
  const navigate = useNavigate();
  const q = useCoupleQuery<{
    name: string;
    inviterName: string;
    expiresAt: string;
    isSelf: boolean;
  }>("invite", "/couples/invite/" + encodeURIComponent(code));
  const accept = useCoupleMutation(
    () => apiClient.post("/couples/accept", { code }),
    "Đã ghép đôi. Chào mừng đến hành trình chung!",
    () => navigate("/couple"),
  );
  return (
    <div className="invite-page">
      <Card>
        <Heart className="couple-heart" size={42} />
        <h1>Một lời mời cùng vun đắp</h1>
        {q.isPending ? (
          <Skeleton />
        ) : q.isError ? (
          <>
            <ErrorBox error={q.error} />
            <p>Mã có thể đã dùng, bị thu hồi hoặc hết hạn.</p>
          </>
        ) : (
          <>
            <h2>{q.data.name}</h2>
            <p>{q.data.inviterName} mời bạn tham gia không gian chung.</p>
            <p className="muted">
              Hết hạn {new Date(q.data.expiresAt).toLocaleString("vi-VN")}
            </p>
            {q.data.isSelf ? (
              <p>Bạn không thể dùng lời mời của chính mình.</p>
            ) : user.coupleId ? (
              <p>
                Bạn đã có không gian chung. Hãy rời hành trình hiện tại trước
                khi ghép đôi.
              </p>
            ) : (
              <>
                <p>
                  Người kia sẽ thấy tên và ảnh đại diện của bạn. Tài chính cá
                  nhân và tập luyện vẫn riêng tư.
                </p>
                <ErrorBox error={accept.error} />
                <Button
                  disabled={accept.isPending}
                  onClick={() => accept.mutate()}
                >
                  {accept.isPending
                    ? "Đang ghép đôi…"
                    : "Chấp nhận và ghép đôi"}
                </Button>
              </>
            )}
          </>
        )}
        <Link className="card-link" to="/couple">
          Về không gian chung
        </Link>
      </Card>
    </div>
  );
}
export function CouplePreview() {
  const q = useCouple();
  if (q.isPending)
    return (
      <Card>
        <Skeleton />
      </Card>
    );
  const c = q.data?.couple;
  return (
    <Card className="couple-dashboard">
      <div className="section-heading">
        <h2>Hành trình chúng mình</h2>
        <Heart size={22} />
      </div>
      {q.isError ? (
        <ErrorBox error={q.error} />
      ) : c ? (
        <>
          <h3>{c.name}</h3>
          <p>{c.members.map((m) => m.name).join(" & ")}</p>
          {c.anniversaryInfo && (
            <p>
              {c.anniversaryInfo.daysTogether.toLocaleString("vi-VN")} ngày bên
              nhau ·{" "}
              {c.anniversaryInfo.isToday
                ? "Hôm nay là ngày kỷ niệm ♡"
                : `Còn ${c.anniversaryInfo.daysUntil} ngày đến kỷ niệm`}
            </p>
          )}
          {c.members.length === 1 && (
            <p className="muted">Chờ người thương tham gia bằng mã mời.</p>
          )}
        </>
      ) : (
        <p>Cùng người thương bắt đầu một hành trình chung.</p>
      )}
      <Link className="card-link" to="/couple">
        Mở không gian chung <ArrowRight size={16} />
      </Link>
    </Card>
  );
}
