import { z } from "zod";
import { objectId, pagination } from "../finance/schema";
import { validDateOnly } from "../../utils/dates";
export const day = z
  .string()
  .refine(validDateOnly, "Ngày không hợp lệ (yyyy-MM-dd).");
export const revision = z.number().int().nonnegative();
const text = z.string().trim().max(2000).default("");
const number = (max: number) => z.number().finite().min(0).max(max);
export const exercise = z
  .object({
    name: z.string().trim().min(1, "Nhập tên bài tập.").max(100),
    muscleGroup: z.enum([
      "Ngực",
      "Lưng",
      "Chân",
      "Vai",
      "Tay",
      "Bụng",
      "Toàn thân",
    ]),
  })
  .strict();
export const exerciseUpdate = exercise
  .partial()
  .strict()
  .refine((x) => Object.keys(x).length > 0, "Chưa có thay đổi.");
const sessionFields = {
  date: day,
  durationMinutes: z.number().finite().positive().max(1440),
  notes: text,
  startTime: z.string().datetime({ offset: true }).nullable().default(null),
  endTime: z.string().datetime({ offset: true }).nullable().default(null),
  mood: z.number().int().min(1).max(5).nullable().default(null),
  bodyWeight: z.number().positive().max(500).nullable().default(null),
};
export const session = z.object(sessionFields).strict();
export const sessionUpdate = z
  .object(sessionFields)
  .partial()
  .extend({ revision })
  .strict();
const setFields = {
  exerciseId: objectId,
  weight: number(1000),
  reps: z.number().int().min(1).max(1000),
  done: z.boolean().default(true),
  setType: z
    .enum(["warmup", "working", "dropset", "failure"])
    .default("working"),
  rpe: z.number().min(1).max(10).multipleOf(0.5).nullable().default(null),
};
export const set = z
  .object({
    ...setFields,
    sessionId: objectId,
    setNumber: z.number().int().min(1).max(10000).optional(),
  })
  .strict();
export const setUpdate = z
  .object(setFields)
  .partial()
  .extend({
    revision,
    setNumber: z.number().int().min(1).max(10000).optional(),
  })
  .strict();
export const remove = z.object({ revision }).strict();
const templateItem = z
  .object({
    exerciseId: objectId,
    weight: setFields.weight,
    reps: setFields.reps,
    setType: setFields.setType,
    rpe: setFields.rpe,
  })
  .strict();
export const template = z
  .object({
    name: z.string().trim().min(1).max(100),
    notes: text,
    items: z.array(templateItem).min(1, "Thêm ít nhất một set.").max(100),
  })
  .strict();
export const templateUpdate = template.extend({ revision }).strict();
const bodyFields = {
  date: day,
  weight: z.number().positive().max(500).nullable().default(null),
  waist: z.number().positive().max(300).nullable().default(null),
  chest: z.number().positive().max(300).nullable().default(null),
  hips: z.number().positive().max(300).nullable().default(null),
  arm: z.number().positive().max(300).nullable().default(null),
  thigh: z.number().positive().max(300).nullable().default(null),
  notes: text,
};
export const body = z
  .object(bodyFields)
  .strict()
  .refine(
    (v) =>
      [v.weight, v.waist, v.chest, v.hips, v.arm, v.thigh].some(
        (x) => x !== null,
      ),
    "Nhập cân nặng hoặc ít nhất một số đo.",
  );
export const bodyUpdate = z
  .object(bodyFields)
  .extend({ revision })
  .strict()
  .refine(
    (v) =>
      [v.weight, v.waist, v.chest, v.hips, v.arm, v.thigh].some(
        (x) => x !== null,
      ),
    "Nhập cân nặng hoặc ít nhất một số đo.",
  );
export const list = pagination
  .extend({ from: day.optional(), to: day.optional() })
  .strict()
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Ngày kết thúc phải sau ngày bắt đầu.",
  );
export const analysis = z
  .object({
    range: z.enum(["7d", "30d", "90d"]).default("30d"),
    from: day.optional(),
    to: day.optional(),
    exerciseId: objectId.optional(),
  })
  .strict()
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Khoảng ngày không hợp lệ.",
  );
export const exerciseQuery = z
  .object({
    search: z.string().max(100).optional(),
    muscleGroup: exercise.shape.muscleGroup.optional(),
  })
  .strict();
export const goal = z
  .object({ sessionsPerWeek: z.number().int().min(1).max(14) })
  .strict();
export const progressParams = z.object({ exerciseId: objectId }).strict();
