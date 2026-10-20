import dotenv from "dotenv";
import fs from "node:fs";
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

  // Tự động nhận diện cấu hình local dev nếu chưa có file .env
  if (!process.env.MONGODB_URI) {
    process.env.MONGODB_URI =
      "mongodb://127.0.0.1:27118/mam_chung_local?replicaSet=mam-chung-local";
  }
  if (!process.env.JWT_SECRET) {
    const secretPath = path.resolve(__dirname, "../../../.local/jwt-secret");
    if (fs.existsSync(secretPath)) {
      process.env.JWT_SECRET = fs.readFileSync(secretPath, "utf8").trim();
    } else {
      process.env.JWT_SECRET =
        "dev-secret-longer-than-thirty-two-characters-fallback";
    }
  }

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

    // Chỉ in ra màn hình terminal một lần duy nhất, KHÔNG ghi vào file log hay logger chung
    console.log(
      "\n================================================================================",
    );
    console.log("ĐẶT LẠI MẬT KHẨU TẠM THỜI THÀNH CÔNG");
    console.log(
      "================================================================================",
    );
    console.log(`- Tài khoản: ${result.user.email} (${result.user.name})`);
    console.log(`- Mật khẩu tạm thời: ${result.temporaryPassword}`);
    console.log(
      "--------------------------------------------------------------------------------",
    );
    console.log(
      "LƯU Ý AN NINH:\n" +
        "1. Hãy sao chép mật khẩu tạm trên và gửi qua kênh tin cậy riêng tư cho người dùng.\n" +
        "2. Toàn bộ phiên đăng nhập cũ trên mọi thiết bị của tài khoản này đã bị thu hồi.\n" +
        "3. Nhắc người dùng đăng nhập và đổi sang mật khẩu riêng ngay tại trang Cài đặt.",
    );
    console.log(
      "================================================================================\n",
    );
  } catch (err) {
    console.error(
      "Lỗi khi đặt lại mật khẩu:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
