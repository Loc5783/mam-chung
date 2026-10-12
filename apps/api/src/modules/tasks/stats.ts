import { z } from "zod";
import { AppError } from "../../utils/AppError";
import { User } from "../users/model";
import { Couple, CoupleMember } from "../couples/models";
import { Task, TaskList } from "./models";
import { zonedDate } from "../../utils/dates";
import { todayInZone } from "../planning/service";
import mongoose from "mongoose";

export const statsQuery = z
  .object({
    range: z.enum(["7d", "30d", "90d"]).default("30d"),
    scope: z.enum(["personal", "shared", "all"]).default("all"),
  })
  .strict();

export type StatsQuery = z.infer<typeof statsQuery>;

export type TaskStatsResponse = {
  completed: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  onTimeRate: number | null;
  streak: {
    current: number;
    best: number;
  };
  byDay: {
    date: string;
    completed: number;
  }[];
  byList: {
    listId: string | null;
    name: string;
    count: number;
    color?: string;
  }[];
  byPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    URGENT: number;
  };
  couple: {
    members: {
      userId: string;
      name: string;
      completed: number;
    }[];
    total: number;
  } | null;
  lateHabits: {
    name: string;
    type: "label" | "list";
    lateCount: number;
    rate: number;
  }[];
};

interface TaskLateCheck {
  deadline?: string | null;
  deadlineHasTime?: boolean | null;
  deadlineTime?: string | null;
  deadlineTimezone?: string | null;
  status: string;
  completedAt?: Date | null;
}

function isTaskLate(t: TaskLateCheck, now: Date, timezone: string): boolean {
  if (!t.deadline) return false;
  const zone = t.deadlineTimezone || timezone;
  const [y, m, d] = t.deadline.split("-").map(Number);
  let deadlineInstant: Date;
  if (t.deadlineHasTime && t.deadlineTime) {
    const [hh, mm] = t.deadlineTime.split(":").map(Number);
    deadlineInstant = new Date(
      zonedDate(y, m, d, zone, hh).getTime() + mm * 60000,
    );
  } else {
    deadlineInstant = new Date(
      zonedDate(y, m, d, zone, 23).getTime() + 59 * 60000 + 59999,
    );
  }
  if (t.status === "DONE" && t.completedAt) {
    return t.completedAt.getTime() > deadlineInstant.getTime();
  }
  return now.getTime() > deadlineInstant.getTime();
}

export const taskStatsService = {
  async get(actor: string, rawQuery: unknown): Promise<TaskStatsResponse> {
    const query = statsQuery.parse(rawQuery);
    const u = await User.findById(actor);
    if (!u) throw new AppError(404, "NOT_FOUND", "Không tìm thấy người dùng.");
    const timezone = u.timezone || "Asia/Ho_Chi_Minh";

    let coupleDoc: InstanceType<typeof Couple> | null = null;
    if (u.coupleId) {
      coupleDoc = await Couple.findById(u.coupleId);
    } else {
      const lastMembership = await CoupleMember.findOne({
        userId: u._id,
        deletedAt: null,
      }).sort({ updatedAt: -1 });
      if (lastMembership) {
        coupleDoc = await Couple.findOne({
          _id: lastMembership.coupleId,
          deletedAt: null,
        });
      }
    }

    // Build scope filter
    let scopeClause: Record<string, unknown>;
    if (query.scope === "personal") {
      scopeClause = { coupleId: null, createdBy: u._id };
    } else if (query.scope === "shared") {
      if (!coupleDoc) {
        scopeClause = { coupleId: new mongoose.Types.ObjectId() };
      } else {
        scopeClause = { coupleId: coupleDoc._id };
      }
    } else {
      // "all"
      if (coupleDoc) {
        scopeClause = {
          $or: [
            { coupleId: null, createdBy: u._id },
            { coupleId: coupleDoc._id },
          ],
        };
      } else {
        scopeClause = { coupleId: null, createdBy: u._id };
      }
    }

    const baseScopeFilter = {
      ...scopeClause,
      deletedAt: null,
      status: { $ne: "CANCELLED" },
    };

    const now = new Date();
    const todayStr = todayInZone(now, timezone);
    const [tYear, tMonth, tDay] = todayStr.split("-").map(Number);
    const daysCount =
      query.range === "7d" ? 7 : query.range === "90d" ? 90 : 30;

    // Generate dates array [oldest ... today]
    const dates: string[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const dt = new Date(Date.UTC(tYear, tMonth - 1, tDay - i, 12));
      dates.push(dt.toISOString().slice(0, 10));
    }
    const rangeStartStr = dates[0];

    const [sYear, sMonth, sDay] = rangeStartStr.split("-").map(Number);
    const rangeStartInstant = zonedDate(sYear, sMonth, sDay, timezone, 0);

    const todayStartInstant = zonedDate(tYear, tMonth, tDay, timezone, 0);
    const todayEndInstant = new Date(
      zonedDate(tYear, tMonth, tDay, timezone, 23).getTime() +
        59 * 60000 +
        59999,
    );
    const rangeEndInstant = todayEndInstant;

    // Week start: Monday of this week in user timezone
    const dObj = new Date(todayStr + "T12:00:00Z");
    const dayOfWeek = (dObj.getUTCDay() + 6) % 7;
    const monObj = new Date(Date.UTC(tYear, tMonth - 1, tDay - dayOfWeek, 12));
    const [monY, monM, monD] = [
      monObj.getUTCFullYear(),
      monObj.getUTCMonth() + 1,
      monObj.getUTCDate(),
    ];
    const weekStartInstant = zonedDate(monY, monM, monD, timezone, 0);

    // Month start: day 1 of current month in user timezone
    const monthStartInstant = zonedDate(tYear, tMonth, 1, timezone, 0);

    const completedTasksFilter = {
      ...baseScopeFilter,
      status: "DONE",
      completedAt: { $ne: null },
    };

    // 1. Completed summary: today / thisWeek / thisMonth
    const summaryAgg = await Task.aggregate([
      { $match: completedTasksFilter },
      {
        $group: {
          _id: null,
          today: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$completedAt", todayStartInstant] },
                    { $lte: ["$completedAt", todayEndInstant] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          thisWeek: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$completedAt", weekStartInstant] },
                    { $lte: ["$completedAt", todayEndInstant] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          thisMonth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$completedAt", monthStartInstant] },
                    { $lte: ["$completedAt", todayEndInstant] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const completed = summaryAgg[0]
      ? {
          today: summaryAgg[0].today,
          thisWeek: summaryAgg[0].thisWeek,
          thisMonth: summaryAgg[0].thisMonth,
        }
      : { today: 0, thisWeek: 0, thisMonth: 0 };

    // 2. byDay aggregation in the range
    const byDayAgg = await Task.aggregate([
      {
        $match: {
          ...completedTasksFilter,
          completedAt: { $gte: rangeStartInstant, $lte: rangeEndInstant },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$completedAt",
              timezone,
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const dayMap = new Map<string, number>();
    for (const row of byDayAgg) {
      if (row._id) dayMap.set(row._id, row.count);
    }
    const byDay = dates.map((date) => ({
      date,
      completed: dayMap.get(date) ?? 0,
    }));

    // 3. Streak calculation (strictly for tasks completed by the actor)
    const actorCompletedFilter = {
      ...completedTasksFilter,
      $or: [{ completedBy: u._id }, { completedBy: null, createdBy: u._id }],
    };

    const streakDaysAgg = await Task.aggregate([
      { $match: actorCompletedFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$completedAt",
              timezone,
            },
          },
        },
      },
    ]);
    const distinctDays = new Set<string>(
      streakDaysAgg.map((r) => r._id).filter(Boolean),
    );

    let current = 0;
    if (distinctDays.has(todayStr)) {
      const checkDt = new Date(Date.UTC(tYear, tMonth - 1, tDay, 12));
      while (distinctDays.has(checkDt.toISOString().slice(0, 10))) {
        current++;
        checkDt.setUTCDate(checkDt.getUTCDate() - 1);
      }
    } else {
      const yestDt = new Date(Date.UTC(tYear, tMonth - 1, tDay - 1, 12));
      const yestStr = yestDt.toISOString().slice(0, 10);
      if (distinctDays.has(yestStr)) {
        while (distinctDays.has(yestDt.toISOString().slice(0, 10))) {
          current++;
          yestDt.setUTCDate(yestDt.getUTCDate() - 1);
        }
      }
    }

    const sortedDays = Array.from(distinctDays).sort();
    let best = 0;
    if (sortedDays.length > 0) {
      best = 1;
      let running = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prev = new Date(sortedDays[i - 1] + "T12:00:00Z");
        const curr = new Date(sortedDays[i] + "T12:00:00Z");
        const diffDays = Math.round(
          (curr.getTime() - prev.getTime()) / 86400000,
        );
        if (diffDays === 1) {
          running++;
          if (running > best) best = running;
        } else {
          running = 1;
        }
      }
    }
    if (current > best) best = current;

    // 4. On-time rate in range
    const tasksWithDeadlinesInRange = await Task.find({
      ...completedTasksFilter,
      completedAt: { $gte: rangeStartInstant, $lte: rangeEndInstant },
      deadline: { $ne: null },
    }).select(
      "completedAt deadline deadlineHasTime deadlineTime deadlineTimezone",
    );

    let onTimeRate: number | null = null;
    if (tasksWithDeadlinesInRange.length > 0) {
      let onTimeCount = 0;
      for (const t of tasksWithDeadlinesInRange) {
        if (!t.deadline || !t.completedAt) continue;
        const zone = t.deadlineTimezone || timezone;
        const [y, m, d] = t.deadline.split("-").map(Number);
        let deadlineInstant: Date;
        if (t.deadlineHasTime && t.deadlineTime) {
          const [hh, mm] = t.deadlineTime.split(":").map(Number);
          deadlineInstant = new Date(
            zonedDate(y, m, d, zone, hh).getTime() + mm * 60000,
          );
        } else {
          deadlineInstant = new Date(
            zonedDate(y, m, d, zone, 23).getTime() + 59 * 60000 + 59999,
          );
        }
        if (t.completedAt.getTime() <= deadlineInstant.getTime()) {
          onTimeCount++;
        }
      }
      onTimeRate =
        Math.round((onTimeCount / tasksWithDeadlinesInRange.length) * 100) /
        100;
    }

    // 5. byPriority in range
    const priorityAgg = await Task.aggregate([
      {
        $match: {
          ...completedTasksFilter,
          completedAt: { $gte: rangeStartInstant, $lte: rangeEndInstant },
        },
      },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);
    const byPriority = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    for (const p of priorityAgg) {
      if (p._id && p._id in byPriority) {
        byPriority[p._id as keyof typeof byPriority] = p.count;
      }
    }

    // 6. byList in range
    const listAgg = await Task.aggregate([
      {
        $match: {
          ...completedTasksFilter,
          completedAt: { $gte: rangeStartInstant, $lte: rangeEndInstant },
        },
      },
      {
        $group: {
          _id: "$listId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const listIds = listAgg.map((r) => r._id).filter(Boolean);
    const listsMap = new Map<string, InstanceType<typeof TaskList>>();
    if (listIds.length > 0) {
      const listsFound = await TaskList.find({ _id: { $in: listIds } });
      for (const l of listsFound) listsMap.set(l.id, l);
    }
    const byList = listAgg.map((r) => {
      if (!r._id) {
        return {
          listId: null,
          name: "Hộp thư vào",
          count: r.count,
          color: "#7E9B57",
        };
      }
      const l = listsMap.get(r._id.toString());
      return {
        listId: r._id.toString(),
        name: l?.name || "Danh sách",
        count: r.count,
        color: l?.color || "#7E9B57",
      };
    });

    // 7. Couple breakdown in range
    let couple: TaskStatsResponse["couple"] = null;
    if (query.scope !== "personal" && coupleDoc) {
      const coupleMembers = await CoupleMember.find({
        coupleId: coupleDoc._id,
        deletedAt: null,
      });
      const memberUserIds = coupleMembers.map((m) => m.userId);
      const partners = await User.find(
        { _id: { $in: memberUserIds } },
        { _id: 1, name: 1 },
      );
      const partnerMap = new Map<string, string>();
      for (const p of partners) {
        partnerMap.set(p._id.toString(), p.name);
      }

      const sharedCompletedAgg = await Task.aggregate([
        {
          $match: {
            coupleId: coupleDoc._id,
            status: "DONE",
            deletedAt: null,
            completedAt: { $gte: rangeStartInstant, $lte: rangeEndInstant },
          },
        },
        {
          $group: {
            _id: "$completedBy",
            count: { $sum: 1 },
          },
        },
      ]);

      const memberCountMap = new Map<string, number>();
      let totalShared = 0;
      for (const r of sharedCompletedAgg) {
        totalShared += r.count;
        if (r._id) {
          memberCountMap.set(r._id.toString(), r.count);
        }
      }

      couple = {
        members: coupleMembers.map((m) => {
          const mId = m.userId.toString();
          return {
            userId: mId,
            name:
              partnerMap.get(mId) ||
              m.nameSnapshot ||
              (mId === u.id ? "Bạn" : "Người ấy"),
            completed: memberCountMap.get(mId) ?? 0,
          };
        }),
        total: totalShared,
      };
    }

    // 8. lateHabits (top 5 labels / lists frequently overdue within range)
    const lateHabitsFilter = {
      ...baseScopeFilter,
      deadline: { $ne: null },
      $or: [
        {
          status: "DONE",
          $or: [
            { completedAt: { $gte: rangeStartInstant, $lte: rangeEndInstant } },
            { deadline: { $gte: rangeStartStr, $lte: todayStr } },
          ],
        },
        {
          status: { $ne: "DONE" },
          deadline: { $gte: rangeStartStr, $lte: todayStr },
        },
      ],
    };

    const tasksWithDeadline = await Task.find(lateHabitsFilter).select(
      "status completedAt deadline deadlineHasTime deadlineTime deadlineTimezone listId labels",
    );

    const labelStats = new Map<string, { late: number; total: number }>();
    const listStats = new Map<string, { late: number; total: number }>();

    for (const t of tasksWithDeadline) {
      const late = isTaskLate(t, now, timezone);
      for (const l of t.labels) {
        const s = labelStats.get(l) || { late: 0, total: 0 };
        s.total++;
        if (late) s.late++;
        labelStats.set(l, s);
      }
      const lKey = t.listId ? t.listId.toString() : "inbox";
      const ls = listStats.get(lKey) || { late: 0, total: 0 };
      ls.total++;
      if (late) ls.late++;
      listStats.set(lKey, ls);
    }

    const lateListIds = Array.from(listStats.keys()).filter(
      (k) => k !== "inbox",
    );
    const foundLateLists = await TaskList.find({ _id: { $in: lateListIds } });
    const listNameMap = new Map<string, string>();
    for (const l of foundLateLists) listNameMap.set(l.id, l.name);

    const habits: {
      name: string;
      type: "label" | "list";
      lateCount: number;
      rate: number;
    }[] = [];

    for (const [l, s] of labelStats.entries()) {
      if (s.late > 0) {
        habits.push({
          name: l,
          type: "label",
          lateCount: s.late,
          rate: Math.round((s.late / s.total) * 100) / 100,
        });
      }
    }

    for (const [lKey, s] of listStats.entries()) {
      if (s.late > 0) {
        const name =
          lKey === "inbox"
            ? "Hộp thư vào"
            : listNameMap.get(lKey) || "Danh sách";
        habits.push({
          name,
          type: "list",
          lateCount: s.late,
          rate: Math.round((s.late / s.total) * 100) / 100,
        });
      }
    }

    habits.sort((a, b) => b.lateCount - a.lateCount || b.rate - a.rate);
    const lateHabits = habits.slice(0, 5);

    return {
      completed,
      onTimeRate,
      streak: {
        current,
        best,
      },
      byDay,
      byList,
      byPriority,
      couple,
      lateHabits,
    };
  },
};
