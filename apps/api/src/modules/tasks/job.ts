import { Task } from "./models";
import { task } from "./service";
import { Notification } from "../notifications/models";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { logger } from "../../config/logger";
export async function runTaskReminderJob(now = new Date()) {
  let after: string | undefined,
    created = 0;
  for (;;) {
    const rows = await Task.find({
      deletedAt: null,
      reminderAt: { $lte: now, $ne: null },
      status: { $in: ["TODO", "IN_PROGRESS"] },
      ...(after ? { _id: { $gt: after } } : {}),
    })
      .sort({ _id: 1 })
      .limit(100);
    if (!rows.length) break;
    for (const row of rows) {
      try {
        const done = await inTransaction(async (s) => {
          const recipient = (row.assignedTo ?? row.createdBy).toString(),
            { t } = await task(recipient, row.id, s, true);
          if (
            !t.reminderAt ||
            t.reminderAt > now ||
            !["TODO", "IN_PROGRESS"].includes(t.status) ||
            (t.assignedTo ?? t.createdBy).toString() !== recipient
          )
            return false;
          const eventKey = `reminder:${t.id}:${t.reminderAt.toISOString()}`;
          if (
            await Notification.exists({ userId: recipient, eventKey }).session(
              s,
            )
          )
            return false;
          await Notification.create(
            [
              {
                userId: recipient,
                eventKey,
                type: "TASK_REMINDER",
                title: "Đến giờ nhắc công việc 🌱",
                message: t.title,
                href: `/tasks?task=${t.id}`,
                payload: { sourceId: t.id },
                occurredAt: now,
              },
            ],
            { session: s },
          );
          return true;
        });
        if (done) created++;
      } catch (error) {
        if (!(error instanceof AppError && error.status === 404))
          logger.warn("Chưa xử lý được một nhắc hẹn; sẽ kiểm tra lại.");
      }
    }
    after = rows.at(-1)!.id as string;
  }
  return { created };
}
export function startTaskReminderJob() {
  let active: Promise<unknown> | null = null,
    stopping = false;
  const tick = () => {
    if (stopping || active) return;
    active = runTaskReminderJob()
      .catch(() => logger.warn("Lượt nhắc hẹn chưa hoàn tất."))
      .finally(() => {
        active = null;
      });
  };
  tick();
  const timer = setInterval(tick, 30000);
  timer.unref();
  return async () => {
    stopping = true;
    clearInterval(timer);
    await active;
  };
}
