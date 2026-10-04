export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  isSystem: boolean;
};
export type SetType = "warmup" | "working" | "dropset" | "failure";
export type WorkoutSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  setNumber: number;
  weight: number;
  reps: number;
  done: boolean;
  setType: SetType;
  rpe: number | null;
  revision: number;
  volume: number;
};
export type Session = {
  id: string;
  date: string;
  durationMinutes: number;
  notes: string;
  startTime: string | null;
  endTime: string | null;
  mood: number | null;
  bodyWeight: number | null;
  revision: number;
  sets: WorkoutSet[];
  volume: number;
};
export type TemplateItem = {
  exerciseId: string;
  weight: number;
  reps: number;
  setType: SetType;
  rpe: number | null;
};
export type Template = {
  id: string;
  name: string;
  notes: string;
  items: TemplateItem[];
  revision: number;
};
export type Body = {
  id: string;
  date: string;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  hips: number | null;
  arm: number | null;
  thigh: number | null;
  notes: string;
  revision: number;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
export type Report = {
  from: string;
  to: string;
  exerciseId: string | null;
  stats: {
    weekSessions: number;
    monthSessions: number;
    rangeSessions: number;
    averageReps: number;
    totalMinutes: number;
    averageMinutes: number;
    lastVolume: number;
    frequencyPerWeek: number;
  };
  volume: { sessionId: string; date: string; volume: number }[];
  repDistribution: {
    name: string;
    range: string;
    count: number;
    percent: number;
  }[];
  progress: {
    sessionId: string;
    date: string;
    maxWeight: number | null;
    oneRM: number | null;
  }[];
  prs: {
    sessionId: string;
    date: string;
    exerciseId: string;
    exerciseName: string;
    weight: number;
    volume: number;
    oneRM: number;
    baseline: boolean;
    flags: { weight: boolean; volume: boolean; oneRM: boolean };
  }[];
  bests: {
    exerciseId: string;
    weight: number;
    volume: number;
    oneRM: number;
  }[];
  comparison: {
    current: { sessions: number; volume: number; averageReps: number };
    previous: { sessions: number; volume: number; averageReps: number };
    delta: { sessions: number; volume: number; averageReps: number };
  };
  weeklyGoal: { target: number; done: number; progress: number };
  body: Body[];
  latest: Session | null;
  continueFrom: Session | null;
};
export const setNames: Record<SetType, string> = {
  warmup: "Khởi động",
  working: "Chính",
  dropset: "Drop set",
  failure: "Đến giới hạn",
};
export const groups = [
  "Ngực",
  "Lưng",
  "Chân",
  "Vai",
  "Tay",
  "Bụng",
  "Toàn thân",
];
