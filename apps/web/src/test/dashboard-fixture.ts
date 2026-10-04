import { HomeData } from "../features/dashboard/types";
export function emptyHome(): HomeData {
  const taskPage = { items: [], total: 0, page: 1, limit: 5, readOnly: false };
  return {
    generatedAt: "2026-10-04T12:00:00Z",
    finance: {
      month: "2026-10",
      timezone: "Asia/Ho_Chi_Minh",
      totalBalance: 0,
      income: 0,
      expense: 0,
      incomeChange: null,
      expenseChange: null,
      wallets: [],
      spending: [],
      recent: [],
    },
    budgets: { month: "2026-10", items: [] },
    tasks: { today: { ...taskPage }, overdue: { ...taskPage } },
    fitness: {
      from: "2026-09-28",
      to: "2026-10-04",
      exerciseId: null,
      stats: {
        weekSessions: 0,
        monthSessions: 0,
        rangeSessions: 0,
        averageReps: 0,
        totalMinutes: 0,
        averageMinutes: 0,
        lastVolume: 0,
        frequencyPerWeek: 0,
      },
      volume: [],
      repDistribution: [],
      progress: [],
      prs: [],
      bests: [],
      comparison: {
        current: { sessions: 0, volume: 0, averageReps: 0 },
        previous: { sessions: 0, volume: 0, averageReps: 0 },
        delta: { sessions: 0, volume: 0, averageReps: 0 },
      },
      weeklyGoal: { target: 3, done: 0, progress: 0 },
      body: [],
      latest: null,
      continueFrom: null,
    },
    couple: null,
    shared: null,
    activity: null,
  };
}
