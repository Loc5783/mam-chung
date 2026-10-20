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
    console.error("Cách dùng: npm run admin:revoke -- --email <email>");
    process.exitCode = 1;
    return;
  }

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
    const { adminService } = await import("../modules/admin/service");
    const result = await adminService.revokeAdminRole(email.trim());
    console.log(
      "\n================================================================================",
    );
    console.log("THU HỒI QUYỀN QUẢN TRỊ VIÊN THÀNH CÔNG");
    console.log(
      "================================================================================",
    );
    console.log(`- Tài khoản: ${result.user.email} (${result.user.name})`);
    console.log(`- ID: ${result.user.id}`);
    console.log(`- Vai trò: ${result.user.role}`);
    console.log(
      `- Trạng thái: ${result.changed ? "Đã thu hồi quyền quản trị" : "Tài khoản vốn không phải quản trị viên"}`,
    );
    console.log(
      "================================================================================\n",
    );
  } catch (err) {
    console.error(
      "Lỗi khi thu hồi quyền admin:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
