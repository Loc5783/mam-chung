import dotenv from "dotenv";
import path from "node:path";

async function main() {
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
    const admins = await adminService.listAdmins();
    console.log(
      "\n================================================================================",
    );
    console.log(
      `DANH SÁCH QUẢN TRỊ VIÊN HỆ THỐNG (Tổng cộng: ${admins.length})`,
    );
    console.log(
      "--------------------------------------------------------------------------------",
    );
    if (admins.length === 0) {
      console.log("Hiện tại chưa có quản trị viên nào trong hệ thống.");
    } else {
      admins.forEach((admin, index) => {
        const status = admin.disabledAt
          ? "Đang bị khóa"
          : admin.lockUntil && admin.lockUntil > new Date()
            ? "Tạm khóa (sai MK)"
            : "Đang hoạt động";
        const lastLogin = admin.lastLoginAt
          ? new Date(admin.lastLoginAt).toLocaleString("vi-VN")
          : "Chưa đăng nhập";
        console.log(
          `${index + 1}. ${admin.name} <${admin.email}> | Trạng thái: ${status} | Đăng nhập cuối: ${lastLogin}`,
        );
      });
    }
    console.log(
      "================================================================================\n",
    );
  } catch (err) {
    console.error(
      "Lỗi lấy danh sách quản trị viên:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
