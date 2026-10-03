import { useState } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Sprout, ArrowLeft, Heart, Leaf } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../components/ui";
import { useUiStore } from "../../app/store";
import { useAuthStore } from "./store";
import {
  apiClient,
  errorMessage,
  setSession,
  SessionResponse,
} from "../../lib/apiClient";
const password = z
  .string()
  .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
  .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Mật khẩu cần có chữ và số.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Mật khẩu không được vượt quá 72 byte.",
  );
const loginSchema = z.object({
  name: z.string().optional(),
  email: z.string().trim().email("Vui lòng nhập email hợp lệ."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});
const registerSchema = loginSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, "Tên cần ít nhất 2 ký tự.")
    .max(100, "Tên không được vượt quá 100 ký tự."),
  password,
});
type Values = z.infer<typeof loginSchema>;
export function AuthPage({ registerMode = false }: { registerMode?: boolean }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(registerMode ? registerSchema : loginSchema),
  });
  const [error, setError] = useState("");
  const notify = useUiStore((s) => s.notify);
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);
  const destination =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/") &&
    !location.state.from.startsWith("//")
      ? location.state.from
      : "/";
  if (status === "authenticated") return <Navigate to={destination} replace />;
  const submit = async (values: Values) => {
    setError("");
    try {
      const { data } = await apiClient.post<SessionResponse>(
        registerMode ? "/auth/register" : "/auth/login",
        registerMode
          ? {
              name: values.name,
              email: values.email,
              password: values.password,
            }
          : { email: values.email, password: values.password },
      );
      setSession(data);
      notify(
        registerMode
          ? "Tài khoản đã sẵn sàng. Chào mừng bạn đến Mầm Chung!"
          : "Đăng nhập thành công. Mừng bạn trở lại!",
      );
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Link className="brand" to="/preview">
          <span className="brand-icon">
            <Sprout />
          </span>
          Mầm Chung<span className="brand-dot">.</span>
        </Link>
        <div className="auth-story-body">
          <span className="eyebrow">MỘT CHÚT MỖI NGÀY</span>
          <h1>
            Cùng vun đắp
            <br />
            những điều <em>nhỏ bé.</em>
          </h1>
          <p>
            Tài chính vững vàng. Công việc gọn gàng.
            <br />
            Sức khỏe tốt hơn. Và một hành trình có nhau.
          </p>
          <div className="plant-art" aria-hidden="true">
            <Leaf className="leaf-one" />
            <Leaf className="leaf-two" />
            <Sprout className="plant-sprout" />
            <Heart className="plant-heart" />
          </div>
        </div>
        <small>Cho bạn, và cho chúng mình.</small>
      </div>
      <main className="auth-main">
        <Link className="back-link" to="/preview">
          <ArrowLeft size={16} /> Xem giao diện mẫu
        </Link>
        <div className="auth-form-wrap">
          <span className="pill">Cùng nhau bắt đầu 🌱</span>
          <h2>{registerMode ? "Gieo một mầm mới" : "Mừng bạn trở lại"}</h2>
          <p>
            {registerMode
              ? "Tạo tài khoản để bắt đầu hành trình của bạn."
              : "Một ngày mới, một bước nhỏ về phía trước."}
          </p>
          <form
            className="live-auth-form"
            onSubmit={handleSubmit(submit)}
            noValidate
          >
            {registerMode && (
              <label>
                Họ và tên
                <input
                  autoComplete="name"
                  placeholder="Tên của bạn"
                  disabled={isSubmitting}
                  {...register("name")}
                />
                {errors.name && (
                  <span className="field-error" role="alert">
                    {errors.name.message}
                  </span>
                )}
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                placeholder="ban@example.com"
                disabled={isSubmitting}
                {...register("email")}
              />
              {errors.email && (
                <span className="field-error" role="alert">
                  {errors.email.message}
                </span>
              )}
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                autoComplete={
                  registerMode ? "new-password" : "current-password"
                }
                placeholder={
                  registerMode
                    ? "Ít nhất 8 ký tự, có chữ và số"
                    : "Nhập mật khẩu của bạn"
                }
                disabled={isSubmitting}
                {...register("password")}
              />
              {errors.password && (
                <span className="field-error" role="alert">
                  {errors.password.message}
                </span>
              )}
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Đang xử lý…"
                : registerMode
                  ? "Tạo tài khoản"
                  : "Đăng nhập"}
            </Button>
          </form>
          <p className="auth-switch">
            {registerMode ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <Link
              to={registerMode ? "/login" : "/register"}
              state={{ from: destination }}
            >
              {registerMode ? "Đăng nhập" : "Đăng ký ngay"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
