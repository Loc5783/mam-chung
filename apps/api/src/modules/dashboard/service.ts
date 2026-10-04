import { z } from "zod";
import { financeService } from "../finance/service";
import { planningService } from "../planning/service";
import { taskService } from "../tasks/service";
import { fitnessService } from "../fitness/service";
import { coupleService } from "../couples/service";
import { sharedService } from "../shared/service";
import { AppError } from "../../utils/AppError";
export const dashboardQuery = z.object({}).strict();
export const dashboardService = {
  async get(id: string, raw: unknown) {
    dashboardQuery.parse(raw);
    const finance = await financeService.dashboard(id),
      budgets = await planningService.budgets(id, {}),
      today = await taskService.list(id, { due: "today", limit: 5 }),
      overdue = await taskService.list(id, { due: "overdue", limit: 5 }),
      fitness = await fitnessService.analysis(id, { range: "7d" });
    let couple = (await coupleService.me(id)).couple,
      shared: Awaited<ReturnType<typeof sharedService.dashboard>> | null = null;
    let activity: Awaited<ReturnType<typeof coupleService.activity>> | null =
      null;
    if (couple) {
      try {
        shared = await sharedService.dashboard(id, { coupleId: couple.id });
        activity = await coupleService.activity(id, {
          coupleId: couple.id,
          limit: 5,
        });
        const current = (await coupleService.me(id)).couple;
        if (current?.id !== couple.id || current.status !== "active") {
          couple = null;
          shared = null;
          activity = null;
        }
      } catch (e) {
        if (!(e instanceof AppError) || e.status !== 404) throw e;
        couple = null;
        shared = null;
        activity = null;
      }
    }
    return {
      generatedAt: new Date(),
      finance,
      budgets,
      tasks: { today, overdue },
      fitness,
      couple,
      shared,
      activity,
    };
  },
};
