import { startTaskReminderJob } from "./modules/tasks/job";
import { startRecurringJob } from "./modules/planning/job";
import mongoose from "mongoose";
import { app } from "./app";
import { connectDatabase } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";
async function start() {
  await connectDatabase();
  const server = app.listen(env.PORT, () =>
    logger.info({ port: env.PORT }, "Mầm Chung đã sẵn sàng"),
  );
  const stopRecurring = startRecurringJob(),
    stopReminders = startTaskReminderJob();
  const stopJob = () => Promise.all([stopRecurring(), stopReminders()]);
  const stop = () => {
    server.close(() => {
      void stopJob()
        .then(() => mongoose.disconnect())
        .then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
void start().catch(() => {
  logger.error(
    "Không thể khởi động. Kiểm tra cấu hình và MongoDB replica set.",
  );
  process.exit(1);
});
