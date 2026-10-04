import { ClientSession } from "mongoose";
import { inTransaction } from "../../utils/transaction";
import { AppError } from "../../utils/AppError";
import { localDateParts } from "../../utils/dates";
import { calendarDate } from "../planning/service";
import { userRepository } from "../users/repository";
import { objectId } from "../finance/schema";
import {
  Exercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
  BodyMetric,
  FitnessGoal,
} from "./models";
import * as z from "./schema";
const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "Không tìm thấy dữ liệu tập luyện hoặc bạn không có quyền truy cập.",
  );
async function user(id: string, s: ClientSession, write = false) {
  const u = await userRepository.byId(id, s);
  if (!u) throw missing();
  if (write && !(await userRepository.touch(id, u.securityVersion, s)))
    throw missing();
  return u;
}
async function exercise(id: string, key: string, s: ClientSession) {
  const e = await Exercise.findOne({
    _id: key,
    deletedAt: null,
    $or: [{ userId: null }, { userId: id }],
  }).session(s);
  if (!e) throw missing();
  return e;
}
async function session(id: string, key: string, s: ClientSession) {
  const w = await WorkoutSession.findOne({
    _id: key,
    userId: id,
    deletedAt: null,
  }).session(s);
  if (!w) throw missing();
  return w;
}
function version(value: number, expected: number) {
  if (value !== expected)
    throw new AppError(
      409,
      "FITNESS_CHANGED",
      "Dữ liệu đã thay đổi. Đóng và mở lại biểu mẫu trước khi sửa.",
    );
}
function times(w: {
  durationMinutes: number;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
}) {
  if (!!w.startTime !== !!w.endTime)
    throw new AppError(400, "TIME_PAIR", "Nhập đủ giờ bắt đầu và kết thúc.");
  if (w.startTime && w.endTime) {
    const minutes =
      (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 60000;
    if (Math.round(minutes * 100) <= 0 || minutes > 1440)
      throw new AppError(
        400,
        "TIME_RANGE",
        "Giờ kết thúc phải sau giờ bắt đầu, tối đa 24 giờ.",
      );
    w.durationMinutes = Math.round(minutes * 100) / 100;
  }
}
const exerciseDto = (e: InstanceType<typeof Exercise>) => ({
  id: e.id as string,
  name: e.name,
  muscleGroup: e.muscleGroup,
  isSystem: e.userId === null,
});
const setDto = (r: InstanceType<typeof WorkoutSet>) => ({
  id: r.id as string,
  sessionId: r.sessionId.toString(),
  exerciseId: r.exerciseId.toString(),
  exerciseName: r.exerciseName,
  muscleGroup: r.muscleGroup,
  setNumber: r.setNumber,
  weight: r.weight,
  reps: r.reps,
  done: r.done,
  setType: r.setType,
  rpe: r.rpe ?? null,
  revision: r.revision,
  volume: r.done ? rounded(r.weight * r.reps) : 0,
});
const sessionDto = (
  w: InstanceType<typeof WorkoutSession>,
  sets: InstanceType<typeof WorkoutSet>[] = [],
) => ({
  id: w.id as string,
  date: w.date,
  durationMinutes: w.durationMinutes,
  notes: w.notes,
  startTime: w.startTime,
  endTime: w.endTime,
  mood: w.mood,
  bodyWeight: w.bodyWeight,
  revision: w.revision,
  sets: sets.map(setDto),
  volume: rounded(
    sets.filter((r) => r.done).reduce((n, r) => n + r.weight * r.reps, 0),
  ),
});
const templateDto = (t: InstanceType<typeof WorkoutTemplate>) => ({
  id: t.id as string,
  name: t.name,
  notes: t.notes,
  items: t.items.map((r) => ({
    exerciseId: r.exerciseId.toString(),
    weight: r.weight,
    reps: r.reps,
    setType: r.setType,
    rpe: r.rpe ?? null,
  })),
  revision: t.revision,
});
const bodyDto = (b: InstanceType<typeof BodyMetric>) => ({
  id: b.id as string,
  date: b.date,
  weight: b.weight,
  waist: b.waist,
  chest: b.chest,
  hips: b.hips,
  arm: b.arm,
  thigh: b.thigh,
  notes: b.notes,
  revision: b.revision,
});
function bounds(q: { from?: string; to?: string }) {
  return q.from || q.to
    ? {
        date: {
          ...(q.from ? { $gte: q.from } : {}),
          ...(q.to ? { $lte: q.to } : {}),
        },
      }
    : {};
}
function shift(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return calendarDate(y, m, d + days)
    .toISOString()
    .slice(0, 10);
}
function today(zone: string) {
  const p = localDateParts(new Date(), zone);
  return calendarDate(p.year, p.month, p.day).toISOString().slice(0, 10);
}
const rounded = (n: number) => Math.round(n * 100) / 100;
async function addSet(
  id: string,
  input: ReturnType<typeof z.set.parse>,
  s: ClientSession,
) {
  await session(id, input.sessionId, s);
  const e = await exercise(id, input.exerciseId, s);
  const last = await WorkoutSet.findOne({
    userId: id,
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    deletedAt: null,
  })
    .sort({ setNumber: -1 })
    .session(s);
  const number = input.setNumber ?? (last?.setNumber ?? 0) + 1;
  if (number > 10000)
    throw new AppError(400, "SET_LIMIT", "Số thứ tự set vượt giới hạn.");
  if (
    await WorkoutSet.exists({
      userId: id,
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      setNumber: number,
      deletedAt: null,
    }).session(s)
  )
    throw new AppError(
      409,
      "SET_NUMBER",
      "Số thứ tự set đã tồn tại cho bài tập này.",
    );
  const [r] = await WorkoutSet.create(
    [
      {
        ...input,
        userId: id,
        setNumber: number,
        exerciseName: e.name,
        muscleGroup: e.muscleGroup,
      },
    ],
    { session: s },
  );
  return r;
}
async function dataset(id: string, s: ClientSession) {
  const sessions = await WorkoutSession.find({ userId: id, deletedAt: null })
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .session(s);
  const sets = await WorkoutSet.find({
    userId: id,
    sessionId: { $in: sessions.map((w) => w._id) },
    deletedAt: null,
  })
    .sort({ setNumber: 1, _id: 1 })
    .session(s);
  return { sessions, sets };
}
function records(
  data: Awaited<ReturnType<typeof dataset>>,
  exerciseId?: string,
) {
  const maxima = new Map<
    string,
    { weight: number; volume: number; oneRM: number }
  >();
  const events = [];
  for (const w of data.sessions) {
    const grouped = new Map<string, InstanceType<typeof WorkoutSet>[]>();
    for (const r of data.sets.filter(
      (r) =>
        r.sessionId.toString() === w.id &&
        r.done &&
        r.setType !== "warmup" &&
        (!exerciseId || r.exerciseId.toString() === exerciseId),
    )) {
      const key = r.exerciseId.toString();
      grouped.set(key, [...(grouped.get(key) ?? []), r]);
    }
    for (const [key, rows] of grouped) {
      const weight = Math.max(...rows.map((r) => r.weight)),
        volume = rows.reduce((n, r) => n + r.weight * r.reps, 0),
        oneRM = Math.max(...rows.map((r) => r.weight * (1 + r.reps / 30)));
      const old = maxima.get(key) ?? { weight: 0, volume: 0, oneRM: 0 };
      const baseline = !maxima.has(key);
      const flags = {
        weight: weight > old.weight,
        volume: volume > old.volume,
        oneRM: oneRM > old.oneRM,
      };
      if (Object.values(flags).some(Boolean))
        events.push({
          sessionId: w.id as string,
          date: w.date,
          exerciseId: key,
          exerciseName: rows[0].exerciseName,
          weight,
          volume: rounded(volume),
          oneRM: rounded(oneRM),
          baseline,
          flags,
        });
      maxima.set(key, {
        weight: Math.max(old.weight, weight),
        volume: Math.max(old.volume, volume),
        oneRM: Math.max(old.oneRM, oneRM),
      });
    }
  }
  return {
    events,
    bests: [...maxima].map(([exerciseId, v]) => ({
      exerciseId,
      ...v,
      volume: rounded(v.volume),
      oneRM: rounded(v.oneRM),
    })),
  };
}
export const fitnessService = {
  async exercises(id: string, raw: unknown) {
    const q = z.exerciseQuery.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s);
      const rows = await Exercise.find({
        deletedAt: null,
        $or: [{ userId: null }, { userId: id }],
        ...(q.muscleGroup ? { muscleGroup: q.muscleGroup } : {}),
      })
        .sort({ name: 1 })
        .session(s);
      return {
        items: rows
          .filter(
            (e) =>
              !q.search ||
              e.name.toLowerCase().includes(q.search.toLowerCase()),
          )
          .map(exerciseDto),
      };
    });
  },
  async createExercise(id: string, raw: unknown) {
    const input = z.exercise.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const [e] = await Exercise.create([{ ...input, userId: id }], {
        session: s,
      });
      return exerciseDto(e);
    });
  },
  async updateExercise(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.exerciseUpdate.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const e = await Exercise.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!e) throw missing();
      Object.assign(e, input);
      await e.save({ session: s });
      return exerciseDto(e);
    });
  },
  async deleteExercise(id: string, rawId: unknown) {
    const key = objectId.parse(rawId);
    await inTransaction(async (s) => {
      await user(id, s, true);
      const e = await Exercise.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!e) throw missing();
      if (
        (await WorkoutSet.exists({
          userId: id,
          exerciseId: key,
          deletedAt: null,
        }).session(s)) ||
        (await WorkoutTemplate.exists({
          userId: id,
          "items.exerciseId": key,
          deletedAt: null,
        }).session(s))
      )
        throw new AppError(
          409,
          "EXERCISE_USED",
          "Bài tập có lịch sử hoặc đang nằm trong mẫu; giữ lại để bảo toàn dữ liệu.",
        );
      e.deletedAt = new Date();
      await e.save({ session: s });
    });
  },
  async createSession(id: string, raw: unknown) {
    const input = z.session.parse(raw);
    times(input);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const [w] = await WorkoutSession.create([{ ...input, userId: id }], {
        session: s,
      });
      return sessionDto(w);
    });
  },
  async sessions(id: string, raw: unknown) {
    const q = z.list.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s);
      const filter = { userId: id, deletedAt: null, ...bounds(q) };
      const total = await WorkoutSession.countDocuments(filter).session(s);
      const rows = await WorkoutSession.find(filter)
        .sort({ date: -1, createdAt: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      const items = [];
      for (const w of rows) {
        const sets = await WorkoutSet.find({
          userId: id,
          sessionId: w._id,
          deletedAt: null,
        })
          .sort({ exerciseId: 1, setNumber: 1 })
          .session(s);
        items.push(sessionDto(w, sets));
      }
      return { items, total, page: q.page, limit: q.limit };
    });
  },
  async getSession(id: string, rawId: unknown) {
    const key = objectId.parse(rawId);
    return inTransaction(async (s) => {
      await user(id, s);
      const w = await session(id, key, s);
      const rows = await WorkoutSet.find({
        sessionId: key,
        userId: id,
        deletedAt: null,
      })
        .sort({ exerciseId: 1, setNumber: 1 })
        .session(s);
      return sessionDto(w, rows);
    });
  },
  async updateSession(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.sessionUpdate.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const w = await session(id, key, s);
      version(w.revision, input.revision);
      const { revision: _, ...fields } = input;
      void _;
      Object.assign(w, fields);
      times(w);
      w.revision++;
      await w.save({ session: s });
      const sets = await WorkoutSet.find({
        sessionId: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      return sessionDto(w, sets);
    });
  },
  async deleteSession(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.remove.parse(raw);
    await inTransaction(async (s) => {
      await user(id, s, true);
      const w = await session(id, key, s);
      version(w.revision, input.revision);
      const deletedAt = new Date();
      w.deletedAt = deletedAt;
      w.revision++;
      await w.save({ session: s });
      await WorkoutSet.updateMany(
        { userId: id, sessionId: key, deletedAt: null },
        { $set: { deletedAt }, $inc: { revision: 1 } },
        { session: s },
      );
    });
  },
  async createSet(id: string, raw: unknown) {
    const input = z.set.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      return setDto(await addSet(id, input, s));
    });
  },
  async updateSet(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.setUpdate.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const r = await WorkoutSet.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!r) throw missing();
      await session(id, r.sessionId.toString(), s);
      version(r.revision, input.revision);
      const { revision: _, ...fields } = input;
      void _;
      Object.assign(r, fields);
      const e = await exercise(id, r.exerciseId.toString(), s);
      if (
        await WorkoutSet.exists({
          _id: { $ne: key },
          userId: id,
          sessionId: r.sessionId,
          exerciseId: r.exerciseId,
          setNumber: r.setNumber,
          deletedAt: null,
        }).session(s)
      )
        throw new AppError(409, "SET_NUMBER", "Số thứ tự set đã tồn tại.");
      r.exerciseName = e.name;
      r.muscleGroup = e.muscleGroup;
      r.revision++;
      await r.save({ session: s });
      return setDto(r);
    });
  },
  async deleteSet(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.remove.parse(raw);
    await inTransaction(async (s) => {
      await user(id, s, true);
      const r = await WorkoutSet.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!r) throw missing();
      await session(id, r.sessionId.toString(), s);
      version(r.revision, input.revision);
      r.deletedAt = new Date();
      r.revision++;
      await r.save({ session: s });
    });
  },
  async templates(id: string) {
    return inTransaction(async (s) => {
      await user(id, s);
      const rows = await WorkoutTemplate.find({ userId: id, deletedAt: null })
        .sort({ createdAt: -1 })
        .session(s);
      return { items: rows.map(templateDto) };
    });
  },
  async createTemplate(id: string, raw: unknown) {
    const input = z.template.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      for (const r of input.items) await exercise(id, r.exerciseId, s);
      const [t] = await WorkoutTemplate.create([{ ...input, userId: id }], {
        session: s,
      });
      return templateDto(t);
    });
  },
  async updateTemplate(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.templateUpdate.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const t = await WorkoutTemplate.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!t) throw missing();
      version(t.revision, input.revision);
      for (const r of input.items) await exercise(id, r.exerciseId, s);
      const { revision: _, ...fields } = input;
      void _;
      Object.assign(t, fields);
      t.revision++;
      await t.save({ session: s });
      return templateDto(t);
    });
  },
  async deleteTemplate(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.remove.parse(raw);
    await inTransaction(async (s) => {
      await user(id, s, true);
      const t = await WorkoutTemplate.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!t) throw missing();
      version(t.revision, input.revision);
      t.deletedAt = new Date();
      t.revision++;
      await t.save({ session: s });
    });
  },
  async startTemplate(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.session.parse(raw);
    times(input);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const t = await WorkoutTemplate.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!t) throw missing();
      const [w] = await WorkoutSession.create([{ ...input, userId: id }], {
        session: s,
      });
      const rows = [];
      for (const r of t.items)
        rows.push(
          await addSet(
            id,
            {
              exerciseId: r.exerciseId.toString(),
              sessionId: w.id,
              weight: r.weight,
              reps: r.reps,
              setType: r.setType as
                "warmup" | "working" | "dropset" | "failure",
              rpe: r.rpe ?? null,
              done: false,
            },
            s,
          ),
        );
      return sessionDto(w, rows);
    });
  },
  async bodies(id: string, raw: unknown) {
    const q = z.list.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s);
      const filter = { userId: id, deletedAt: null, ...bounds(q) };
      const total = await BodyMetric.countDocuments(filter).session(s);
      const rows = await BodyMetric.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .session(s);
      return { items: rows.map(bodyDto), total, page: q.page, limit: q.limit };
    });
  },
  async createBody(id: string, raw: unknown) {
    const input = z.body.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      if (
        await BodyMetric.exists({
          userId: id,
          date: input.date,
          deletedAt: null,
        }).session(s)
      )
        throw new AppError(
          409,
          "BODY_DATE",
          "Ngày này đã có số đo; sửa bản hiện có.",
        );
      const [b] = await BodyMetric.create([{ ...input, userId: id }], {
        session: s,
      });
      return bodyDto(b);
    });
  },
  async updateBody(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.bodyUpdate.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      const b = await BodyMetric.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!b) throw missing();
      version(b.revision, input.revision);
      if (
        await BodyMetric.exists({
          _id: { $ne: key },
          userId: id,
          date: input.date,
          deletedAt: null,
        }).session(s)
      )
        throw new AppError(409, "BODY_DATE", "Ngày này đã có số đo.");
      const { revision: _, ...fields } = input;
      void _;
      Object.assign(b, fields);
      b.revision++;
      await b.save({ session: s });
      return bodyDto(b);
    });
  },
  async deleteBody(id: string, rawId: unknown, raw: unknown) {
    const key = objectId.parse(rawId),
      input = z.remove.parse(raw);
    await inTransaction(async (s) => {
      await user(id, s, true);
      const b = await BodyMetric.findOne({
        _id: key,
        userId: id,
        deletedAt: null,
      }).session(s);
      if (!b) throw missing();
      version(b.revision, input.revision);
      b.deletedAt = new Date();
      b.revision++;
      await b.save({ session: s });
    });
  },
  async goal(id: string) {
    return inTransaction(async (s) => {
      await user(id, s);
      return {
        sessionsPerWeek:
          (await FitnessGoal.findOne({ userId: id }).session(s))
            ?.sessionsPerWeek ?? 4,
      };
    });
  },
  async updateGoal(id: string, raw: unknown) {
    const input = z.goal.parse(raw);
    return inTransaction(async (s) => {
      await user(id, s, true);
      await FitnessGoal.updateOne(
        { userId: id },
        { $set: input },
        { session: s, upsert: true },
      );
      return input;
    });
  },
  async last(id: string, raw: unknown) {
    const key = objectId.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(id, s);
      await exercise(id, key, s);
      const data = await dataset(id, s);
      const now = today(u.timezone);
      for (const w of [...data.sessions].reverse()) {
        if (w.date > now) continue;
        const rows = data.sets.filter(
          (r) =>
            r.sessionId.toString() === w.id &&
            r.exerciseId.toString() === key &&
            r.done,
        );
        if (rows.length)
          return { date: w.date, sessionId: w.id, sets: rows.map(setDto) };
      }
      return { date: null, sessionId: null, sets: [] };
    });
  },
  async analysis(id: string, raw: unknown) {
    const q = z.analysis.parse(raw);
    return inTransaction(async (s) => {
      const u = await user(id, s);
      if (q.exerciseId) await exercise(id, q.exerciseId, s);
      const data = await dataset(id, s),
        now = today(u.timezone),
        from = q.from ?? shift(now, -Number(q.range.slice(0, -1)) + 1),
        to = q.to ?? now;
      if (from > to)
        throw new AppError(400, "DATE_RANGE", "Khoảng ngày không hợp lệ.");
      const included = data.sessions.filter(
        (w) => w.date >= from && w.date <= to,
      );
      const selected = new Set(included.map((w) => w.id));
      const rows = data.sets.filter(
        (r) =>
          r.done &&
          selected.has(r.sessionId.toString()) &&
          (!q.exerciseId || r.exerciseId.toString() === q.exerciseId),
      );
      const points = included.map((w) => ({
        sessionId: w.id as string,
        date: w.date,
        volume: rounded(
          rows
            .filter((r) => r.sessionId.toString() === w.id)
            .reduce((n, r) => n + r.weight * r.reps, 0),
        ),
      }));
      const buckets = [
        {
          name: "Nặng",
          range: "1–5 rep",
          count: rows.filter((r) => r.reps <= 5).length,
        },
        {
          name: "Vừa",
          range: "6–12 rep",
          count: rows.filter((r) => r.reps >= 6 && r.reps <= 12).length,
        },
        {
          name: "Nhẹ",
          range: "13+ rep",
          count: rows.filter((r) => r.reps >= 13).length,
        },
      ].map((b) => ({
        ...b,
        percent: rows.length ? rounded((b.count / rows.length) * 100) : 0,
      }));
      const monday = shift(
          now,
          -((new Date(now + "T00:00:00Z").getUTCDay() + 6) % 7),
        ),
        next = shift(monday, 7),
        previous = shift(monday, -7),
        month = now.slice(0, 7);
      const week = data.sessions.filter(
          (w) => w.date >= monday && w.date < next && w.date <= now,
        ),
        prev = data.sessions.filter(
          (w) => w.date >= previous && w.date < monday,
        );
      const summary = (ws: typeof included) => {
        const ids = new Set(ws.map((w) => w.id));
        const rs = data.sets.filter(
          (r) =>
            r.done &&
            ids.has(r.sessionId.toString()) &&
            (!q.exerciseId || r.exerciseId.toString() === q.exerciseId),
        );
        return {
          sessions: ws.length,
          volume: rounded(rs.reduce((n, r) => n + r.weight * r.reps, 0)),
          averageReps: rs.length
            ? rounded(rs.reduce((n, r) => n + r.reps, 0) / rs.length)
            : 0,
        };
      };
      const current = summary(week),
        prior = summary(prev),
        target =
          (await FitnessGoal.findOne({ userId: id }).session(s))
            ?.sessionsPerWeek ?? 4;
      const totalMinutes = included.reduce((n, w) => n + w.durationMinutes, 0);
      const prs = records(
        { ...data, sessions: data.sessions.filter((w) => w.date <= to) },
        q.exerciseId,
      );
      const progress = included.map((w) => {
        const rs = rows.filter(
          (r) => r.sessionId.toString() === w.id && r.setType !== "warmup",
        );
        return {
          sessionId: w.id as string,
          date: w.date,
          maxWeight: rs.length ? Math.max(...rs.map((r) => r.weight)) : null,
          oneRM: rs.length
            ? rounded(Math.max(...rs.map((r) => r.weight * (1 + r.reps / 30))))
            : null,
        };
      });
      const metrics = await BodyMetric.find({
        userId: id,
        deletedAt: null,
        date: { $gte: from, $lte: to },
      })
        .sort({ date: 1 })
        .session(s);
      const latest = data.sessions.filter((w) => w.date <= now).at(-1);
      const continueFrom = data.sessions
        .filter(
          (w) =>
            w.date <= now &&
            data.sets.some((r) => r.done && r.sessionId.toString() === w.id),
        )
        .at(-1);
      return {
        continueFrom: continueFrom
          ? sessionDto(
              continueFrom,
              data.sets.filter(
                (r) => r.sessionId.toString() === continueFrom.id,
              ),
            )
          : null,
        from,
        to,
        exerciseId: q.exerciseId ?? null,
        stats: {
          weekSessions: week.length,
          monthSessions: data.sessions.filter(
            (w) => w.date.startsWith(month) && w.date <= now,
          ).length,
          rangeSessions: included.length,
          averageReps: rows.length
            ? rounded(rows.reduce((n, r) => n + r.reps, 0) / rows.length)
            : 0,
          totalMinutes: rounded(totalMinutes),
          averageMinutes: included.length
            ? rounded(totalMinutes / included.length)
            : 0,
          lastVolume: latest
            ? rounded(
                data.sets
                  .filter(
                    (r) =>
                      r.done &&
                      r.sessionId.toString() === latest.id &&
                      (!q.exerciseId ||
                        r.exerciseId.toString() === q.exerciseId),
                  )
                  .reduce((n, r) => n + r.weight * r.reps, 0),
              )
            : 0,
          frequencyPerWeek: rounded(
            (included.length /
              ((Date.parse(to + "T00:00:00Z") -
                Date.parse(from + "T00:00:00Z")) /
                86400000 +
                1)) *
              7,
          ),
        },
        volume: points,
        repDistribution: buckets,
        progress,
        prs: prs.events.filter((r) => r.date >= from && r.date <= to),
        bests: prs.bests,
        comparison: {
          current,
          previous: prior,
          delta: {
            sessions: current.sessions - prior.sessions,
            volume: rounded(current.volume - prior.volume),
            averageReps: rounded(current.averageReps - prior.averageReps),
          },
        },
        weeklyGoal: {
          target,
          done: week.length,
          progress: Math.min(100, rounded((week.length / target) * 100)),
        },
        body: metrics.map(bodyDto),
        latest: latest
          ? sessionDto(
              latest,
              data.sets.filter((r) => r.sessionId.toString() === latest.id),
            )
          : null,
      };
    });
  },
};
