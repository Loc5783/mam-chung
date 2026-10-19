import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound, ShieldCheck, LogOut, Trash2, Sparkles } from "lucide-react";
import {
  apiClient,
  clearSession,
  errorMessage,
  getSessionEpoch,
} from "../../lib/apiClient";
import {
  getMotionPreference,
  setMotionPreference,
  type MotionPreference,
} from "../../lib/motion";
import { useAuthStore, Profile } from "../auth/store";
import { useUiStore } from "../../app/store";
import { Button, Card, Skeleton } from "../../components/ui";
import { Modal } from "../../components/ui/Modal";
const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Tên cần ít nhất 2 ký tự.")
    .max(100, "Tên quá dài."),
  avatar: z.union([
    z.literal(""),
    z
      .string()
      .url("Đường dẫn ảnh không hợp lệ.")
      .refine(
        (url) => url.startsWith("https://"),
        "Ảnh đại diện cần dùng HTTPS.",
      ),
  ]),
  timezone: z.string().min(1, "Vui lòng chọn múi giờ."),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: z
      .string()
      .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
      .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Mật khẩu cần có chữ và số.")
      .refine(
        (v) => new TextEncoder().encode(v).length <= 72,
        "Mật khẩu không được vượt quá 72 byte.",
      ),
    confirmation: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmation, {
    path: ["confirmation"],
    message: "Mật khẩu nhập lại chưa khớp.",
  });
type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
function ProfileForm({ user }: { user: Profile }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      avatar: user.avatar ?? "",
      timezone: user.timezone,
    },
  });
  const client = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const mutation = useMutation({
    mutationFn: async (values: ProfileValues) =>
      (
        await apiClient.put<Profile>("/users/me", {
          ...values,
          avatar: values.avatar || null,
        })
      ).data,
    onMutate: () => ({ epoch: getSessionEpoch(), id: user.id }),
    onSuccess: async (data, _v, context) => {
      if (
        context?.epoch !== getSessionEpoch() ||
        context.id !== useAuthStore.getState().user?.id
      )
        return;
      useAuthStore.getState().updateUser(data);
      client.setQueryData(["profile", user.id], data);
      if (data.timezone !== user.timezone) {
        await client.invalidateQueries({ queryKey: ["dashboard", user.id] });
        await client.invalidateQueries({
          queryKey: ["notifications", user.id],
        });
        await client.invalidateQueries({ queryKey: ["finance", user.id] });
        await client.invalidateQueries({ queryKey: ["couple", user.id] });
        await client.invalidateQueries({ queryKey: ["shared", user.id] });
        await client.invalidateQueries({ queryKey: ["tasks", user.id] });
        await client.invalidateQueries({ queryKey: ["fitness", user.id] });
      }
      notify("Đã cập nhật hồ sơ.");
    },
  });
  return (
    <form
      className="settings-form"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      noValidate
    >
      <label>
        Họ và tên
        <input
          {...register("name")}
          autoComplete="name"
          disabled={mutation.isPending}
        />
        {errors.name && (
          <span className="field-error" role="alert">
            {errors.name.message}
          </span>
        )}
      </label>
      <label>
        Email
        <input value={user.email} readOnly aria-readonly="true" />
        <small>Email được dùng để đăng nhập.</small>
      </label>
      <label>
        Ảnh đại diện (đường dẫn HTTPS)
        <input
          {...register("avatar")}
          placeholder="https://example.com/anh-cua-ban.jpg"
          disabled={mutation.isPending}
        />
        {errors.avatar && (
          <span className="field-error" role="alert">
            {errors.avatar.message}
          </span>
        )}
      </label>
      <label>
        Múi giờ
        <select {...register("timezone")} disabled={mutation.isPending}>
          {![
            "Asia/Ho_Chi_Minh",
            "Asia/Bangkok",
            "Asia/Tokyo",
            "Europe/London",
            "America/New_York",
            "UTC",
          ].includes(user.timezone) && (
            <option value={user.timezone}>{user.timezone}</option>
          )}
          <option value="Asia/Ho_Chi_Minh">Việt Nam (UTC+7)</option>
          <option value="Asia/Bangkok">Bangkok (UTC+7)</option>
          <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
          <option value="Europe/London">London</option>
          <option value="America/New_York">New York</option>
          <option value="UTC">UTC</option>
        </select>
      </label>
      {mutation.error && (
        <div className="form-error" role="alert">
          {errorMessage(mutation.error)}
        </div>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Đang lưu…" : "Lưu thay đổi"}
      </Button>
    </form>
  );
}

function MotionPreferenceControl() {
  const [pref, setPref] = useState<MotionPreference>(() =>
    getMotionPreference(),
  );
  const notify = useUiStore((s) => s.notify);

  const selectPreference = (next: MotionPreference) => {
    setPref(next);
    setMotionPreference(next);
    notify(
      next === "reduced"
        ? "Đã chọn giảm hiệu ứng chuyển động."
        : next === "full"
          ? "Đã bật toàn bộ hiệu ứng chuyển động."
          : "Đã bật hiệu ứng tự động theo hệ thống.",
    );
  };

  return (
    <div
      className="motion-options"
      role="radiogroup"
      aria-label="Tùy chọn hiệu ứng chuyển động"
    >
      <label className={`motion-option ${pref === "system" ? "active" : ""}`}>
        <input
          type="radio"
          name="motion-pref"
          value="system"
          checked={pref === "system"}
          onChange={() => selectPreference("system")}
        />
        <div>
          <b>Tự động theo hệ thống</b>
          <small>
            Bật hoặc giảm chuyển động tùy theo cài đặt của hệ điều hành.
          </small>
        </div>
      </label>
      <label className={`motion-option ${pref === "full" ? "active" : ""}`}>
        <input
          type="radio"
          name="motion-pref"
          value="full"
          checked={pref === "full"}
          onChange={() => selectPreference("full")}
        />
        <div>
          <b>Luôn bật hiệu ứng</b>
          <small>
            Hiển thị đầy đủ chuyển động mượt mà, số đếm tăng và biểu đồ quét.
          </small>
        </div>
      </label>
      <label className={`motion-option ${pref === "reduced" ? "active" : ""}`}>
        <input
          type="radio"
          name="motion-pref"
          value="reduced"
          checked={pref === "reduced"}
          onChange={() => selectPreference("reduced")}
        />
        <div>
          <b>Luôn giảm chuyển động</b>
          <small>
            Tối giản hoạt ảnh; số liệu và biểu đồ hiển thị ngay trạng thái cuối.
          </small>
        </div>
      </label>
    </div>
  );
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)!;
  const client = useQueryClient();
  const notify = useUiStore((s) => s.notify);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const closeDelete = useCallback(() => {
    setDeleting(false);
    setPassword("");
  }, []);
  const profile = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await apiClient.get<Profile>("/users/me")).data,
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });
  const finish = (message: string) => {
    clearSession();
    client.clear();
    notify(message);
    navigate("/login", { replace: true });
  };
  const change = useMutation({
    mutationFn: async (v: PasswordValues) => {
      await apiClient.post("/auth/change-password", {
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
    },
    onSuccess: () =>
      finish("Đã đổi mật khẩu và đăng xuất mọi phiên. Vui lòng đăng nhập lại."),
  });
  const remove = useMutation({
    mutationFn: async () => {
      await apiClient.delete("/users/me", { data: { password } });
    },
    onSuccess: () =>
      finish("Tài khoản đã được xóa. Cảm ơn bạn đã đồng hành cùng Mầm Chung."),
  });
  const logout = async () => {
    setLogoutPending(true);
    setLogoutError("");
    try {
      await apiClient.post("/auth/logout");
      finish("Bạn đã đăng xuất. Hẹn gặp lại!");
    } catch (error) {
      setLogoutError(errorMessage(error));
    } finally {
      setLogoutPending(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KHÔNG GIAN CỦA BẠN</span>
          <h1>Hồ sơ & cài đặt</h1>
          <p>Chăm chút thông tin cá nhân và bảo vệ tài khoản.</p>
        </div>
      </div>
      <div className="settings-grid">
        <Card>
          <div className="section-heading">
            <h2>Thông tin của bạn</h2>
            <UserRound size={24} />
          </div>
          {profile.isPending ? (
            <Skeleton />
          ) : profile.isError ? (
            <div className="settings-error">
              <p role="alert">{errorMessage(profile.error)}</p>
              <Button onClick={() => void profile.refetch()}>Thử lại</Button>
            </div>
          ) : (
            <ProfileForm user={profile.data} />
          )}
        </Card>
        <div className="settings-side">
          <Card>
            <div className="section-heading">
              <h2>Đổi mật khẩu</h2>
              <ShieldCheck size={24} />
            </div>
            <p className="settings-description">
              Sau khi đổi mật khẩu, bạn cần đăng nhập lại trên mọi thiết bị.
            </p>
            <form
              className="settings-form"
              onSubmit={handleSubmit((v) => change.mutate(v))}
              noValidate
            >
              <label>
                Mật khẩu hiện tại
                <input
                  type="password"
                  autoComplete="current-password"
                  {...register("currentPassword")}
                  disabled={change.isPending}
                />
                {errors.currentPassword && (
                  <span className="field-error" role="alert">
                    {errors.currentPassword.message}
                  </span>
                )}
              </label>
              <label>
                Mật khẩu mới
                <input
                  type="password"
                  autoComplete="new-password"
                  {...register("newPassword")}
                  disabled={change.isPending}
                />
                {errors.newPassword && (
                  <span className="field-error" role="alert">
                    {errors.newPassword.message}
                  </span>
                )}
              </label>
              <label>
                Nhập lại mật khẩu mới
                <input
                  type="password"
                  autoComplete="new-password"
                  {...register("confirmation")}
                  disabled={change.isPending}
                />
                {errors.confirmation && (
                  <span className="field-error" role="alert">
                    {errors.confirmation.message}
                  </span>
                )}
              </label>
              {change.error && (
                <div className="form-error" role="alert">
                  {errorMessage(change.error)}
                </div>
              )}
              <Button type="submit" disabled={change.isPending}>
                {change.isPending ? "Đang xử lý…" : "Đổi mật khẩu"}
              </Button>
            </form>
          </Card>
          <Card>
            <div className="section-heading">
              <h2>Hiệu ứng chuyển động</h2>
              <Sparkles size={22} />
            </div>
            <p className="settings-description">
              Tùy chỉnh chuyển động mượt mà, số đếm tăng và hiệu ứng biểu đồ
              trên toàn ứng dụng.
            </p>
            <MotionPreferenceControl />
          </Card>
          <Card>
            <h2>Phiên đăng nhập</h2>
            <p className="settings-description">
              Đăng xuất khỏi thiết bị đang sử dụng.
            </p>
            {logoutError && (
              <p className="field-error" role="alert">
                {logoutError}
              </p>
            )}
            <Button
              className="button-outline"
              onClick={() => void logout()}
              disabled={logoutPending}
            >
              <LogOut size={17} />
              {logoutPending ? "Đang đăng xuất…" : "Đăng xuất"}
            </Button>
          </Card>
          <Card className="danger-card">
            <h2>Xóa tài khoản</h2>
            <p className="settings-description">
              Tài khoản sẽ ngừng hoạt động và mọi phiên đăng nhập sẽ bị thu hồi.
              Bạn cần nhập mật khẩu để xác nhận.
            </p>
            <Button
              className="button-danger"
              onClick={() => {
                remove.reset();
                setDeleting(true);
              }}
            >
              <Trash2 size={17} />
              Xóa tài khoản
            </Button>
          </Card>
        </div>
      </div>
      {deleting && (
        <Modal
          title="Bạn muốn xóa tài khoản?"
          onClose={closeDelete}
          busy={remove.isPending}
        >
          <p className="settings-description">
            Bạn sẽ không thể đăng nhập vào tài khoản này sau khi xóa.
          </p>
          <form
            className="settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) remove.mutate();
            }}
          >
            <label>
              Mật khẩu xác nhận
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={remove.isPending}
              />
            </label>
            {remove.error && (
              <div className="form-error" role="alert">
                {errorMessage(remove.error)}
              </div>
            )}
            <div className="modal-actions">
              <Button
                type="button"
                className="button-outline"
                onClick={closeDelete}
                disabled={remove.isPending}
              >
                Giữ tài khoản
              </Button>
              <Button
                type="submit"
                className="button-danger"
                disabled={!password || remove.isPending}
              >
                {remove.isPending ? "Đang xóa…" : "Xác nhận xóa"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
