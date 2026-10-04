import { z } from "zod";
import { pagination } from "../finance/schema";
export const types = [
  "COUPLE_INVITE",
  "INVITE_ACCEPTED",
  "DEBT_NEW",
  "PAYMENT_CONFIRM",
  "TASK_ASSIGNED",
  "TASK_DUE",
  "BUDGET_EXCEEDED",
] as const;
export const list = pagination
  .extend({
    unread: z.enum(["true", "false"]).optional(),
    type: z.enum(types).optional(),
  })
  .strict();
export const empty = z.object({}).strict();
