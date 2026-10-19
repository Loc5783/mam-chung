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
    console.error("Cách dùng: npm run admin:revoke -- --email <email>");
    process.exitCode = 1;
    return;
  }

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
    const { adminService } = await import("../modules/admin/service");
    const result = await adminService.revokeAdminRole(email.trim());
    console.log(
      "\n================================================================================",
    );
    console.log("GỠ QUYỀN QUẢN TRỊ VIÊN THÀNH CÔNG");
    console.log(`Người dùng  : ${result.user.name} (${result.user.email})`);
    console.log(`Vai trò mới : user`);
    console.log(
      "Toàn bộ phiên đăng nhập của người dùng này đã được thu hồi lập tức.",
    );
    console.log("Đã ghi nhật ký hoạt động (audit log).");
    console.log(
      "================================================================================\n",
    );
  } catch (err) {
    console.error(
      "Lỗi gỡ quyền quản trị:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
