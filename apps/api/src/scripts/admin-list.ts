import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

async function main() {
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
    const admins = await adminService.listAdmins();
    console.log(
      "\n================================================================================",
    );
    console.log(
      `DANH SÁCH QUẢN TRỊ VIÊN HỆ THỐNG (Tổng cộng: ${admins.length})`,
    );
    console.log(
      "================================================================================",
    );
    if (admins.length === 0) {
      console.log("Hiện tại chưa có tài khoản nào giữ quyền admin.");
    } else {
      admins.forEach((admin, idx) => {
        console.log(
          `${idx + 1}. [${admin.id}] ${admin.email} (Tên: ${admin.name || "N/A"}) - Tạo ngày: ${new Date(admin.createdAt).toLocaleString("vi-VN")}`,
        );
      });
    }
    console.log(
      "================================================================================\n",
    );
  } catch (err) {
    console.error(
      "Lỗi khi lấy danh sách admin:",
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
