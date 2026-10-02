import { Link } from "react-router-dom";
import { Sprout, ArrowLeft, Heart, Leaf } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../components/ui";
import { useUiStore } from "../../app/store";
const schema = z.object({
  name: z.string().optional(),
  email: z.string().email("Vui lòng nhập email hợp lệ."),
  password: z
    .string()
    .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
    .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Mật khẩu cần có chữ và số."),
});
type Values = z.infer<typeof schema>;
export function AuthPage({ registerMode = false }: { registerMode?: boolean }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(
      registerMode
        ? schema.extend({
            name: z.string().trim().min(2, "Tên cần ít nhất 2 ký tự."),
          })
        : schema,
    ),
  });
  const notify = useUiStore((s) => s.notify);
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Link className="brand" to="/">
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
        <Link className="back-link" to="/">
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
          <div className="demo-note">
            Giai đoạn 0 · Biểu mẫu minh họa, chưa kết nối xác thực.
          </div>
          <form
            onSubmit={handleSubmit(() =>
              notify(
                "Biểu mẫu hợp lệ. Xác thực thật sẽ được kết nối ở giai đoạn 1.",
              ),
            )}
            noValidate
          >
            {registerMode && (
              <label>
                Họ và tên
                <input
                  autoComplete="name"
                  placeholder="Tên của bạn"
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
                placeholder="Ít nhất 8 ký tự, có chữ và số"
                {...register("password")}
              />
              {errors.password && (
                <span className="field-error" role="alert">
                  {errors.password.message}
                </span>
              )}
            </label>
            <Button type="submit">
              {registerMode ? "Tạo tài khoản mẫu" : "Kiểm tra đăng nhập mẫu"}
            </Button>
          </form>
          <p className="auth-switch">
            {registerMode ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <Link to={registerMode ? "/login" : "/register"}>
              {registerMode ? "Đăng nhập" : "Đăng ký ngay"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
