import { Recurring } from "./models";
import { User } from "../users/model";
import { planningService } from "./service";
import { logger } from "../../config/logger";
export async function runRecurringJob(now = new Date()) {
  const upper = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  let after: string | undefined;
  let created = 0,
    blocked = 0;
  for (;;) {
    const templates = await Recurring.find({
      enabled: true,
      deletedAt: null,
      nextDate: { $lte: upper },
      ...(after ? { _id: { $gt: after } } : {}),
    })
      .sort({ _id: 1 })
      .limit(100);
    if (!templates.length) break;
    for (const template of templates) {
      if (!(await User.exists({ _id: template.userId, deletedAt: null })))
        continue;
      try {
        const result = await planningService.runRecurring(
          template.userId.toString(),
          template.id as string,
          now,
          false,
        );
        created += result.created;
        if (result.error) blocked++;
      } catch {
        logger.warn(
          "Không thể xử lý một lịch định kỳ; sẽ kiểm tra lại ở lượt sau.",
        );
      }
    }
    after = templates.at(-1)!.id as string;
  }
  return { created, blocked };
}
export function startRecurringJob() {
  let active: Promise<unknown> | null = null,
    stopping = false;
  const tick = () => {
    if (active || stopping) return;
    active = runRecurringJob()
      .catch(() =>
        logger.warn("Lượt kiểm tra giao dịch định kỳ chưa hoàn tất."),
      )
      .finally(() => {
        active = null;
      });
  };
  tick();
  const timer = setInterval(tick, 60000);
  timer.unref();
  return async () => {
    stopping = true;
    clearInterval(timer);
    await active;
  };
}
