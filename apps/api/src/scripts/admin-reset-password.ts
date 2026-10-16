import dotenv from "dotenv";
import path from "node:path";

function parseArgs(args: string[]): { email?: string } {
  let email: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--email" && i + 1 < args.length) {
      email = args[i + 1];
      i++;
    } else if (arg.startsWith("--email=")) {
      email = arg.slice("--email=".length);
    }
  }
  return { email };
}

async function main() {
  const { email } = parseArgs(process.argv.slice(2));
  if (!email || !email.trim()) {
    console.error("Lỗi: Thiếu tham số --email.");
    console.error("Cách dùng: npm run admin:reset-password -- --email <email>");
    console.error(
      "Ví dụ: docker compose exec api node apps/api/dist/scripts/admin-reset-password.js --email user@example.com",
    );
    process.exitCode = 1;
    return;
  }

  // Nạp cấu hình môi trường (.env) nếu chưa được Docker set
  dotenv.config();
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

  let mongoose: typeof import("mongoose");
  try {
    const dbModule = await import("../config/db");
    mongoose = (await import("mongoose")).default;
    await dbModule.connectDatabase();
  } catch (err) {
    console.error(
      "Lỗi kết nối cơ sở dữ liệu:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
    return;
  }

  try {
    const { authService } = await import("../modules/auth/service");
    const result = await authService.adminResetPassword(email.trim());
    console.log(
      "\n================================================================================",
    );
    console.log("ĐẶT LẠI MẬT KHẨU THÀNH CÔNG");
    console.log(
      `Người dùng       : ${result.user.name} (${result.user.email})`,
    );
    console.log(`Mật khẩu tạm thời: ${result.temporaryPassword}`);
    console.log(
      "--------------------------------------------------------------------------------",
    );
    console.log("LƯU Ý BẢO MẬT:");
    console.log(
      "1. Mật khẩu tạm này chỉ hiển thị MỘT LẦN DUY NHẤT tại màn hình này.",
    );
    console.log("2. Toàn bộ phiên đăng nhập cũ trên mọi thiết bị đã bị thu hồi.");
    console.log(
      "3. Gửi mật khẩu qua kênh riêng an toàn và nhắc người dùng đổi ngay sau khi vào.",
    );
    console.log(
      "================================================================================\n",
    );
  } catch (err) {
    console.error(
      "Lỗi đặt lại mật khẩu:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
