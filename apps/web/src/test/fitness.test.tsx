import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { FitnessForm, FitnessDialog } from "../features/fitness/FitnessForm";
import {
  FitnessPage,
  FitnessPreview,
  RestTimer,
} from "../features/fitness/FitnessPage";
import { Session, WorkoutSet, Report } from "../features/fitness/types";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../features/auth/store";
vi.mock("recharts", () => {
  const wrap = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const empty = () => null;
  return {
    ResponsiveContainer: wrap,
    LineChart: wrap,
    PieChart: wrap,
    Pie: wrap,
    Line: empty,
    XAxis: empty,
    YAxis: empty,
    Tooltip: empty,
    Cell: empty,
    CartesianGrid: empty,
  };
});
const exercises = [
  { id: "bench", name: "Bench Press", muscleGroup: "Ngực", isSystem: true },
  { id: "squat", name: "Squat", muscleGroup: "Chân", isSystem: true },
];
const row: WorkoutSet = {
  id: "set",
  sessionId: "session",
  exerciseId: "bench",
  exerciseName: "Bench Press",
  muscleGroup: "Ngực",
  weight: 80,
  reps: 8,
  done: true,
  setNumber: 1,
  setType: "working",
  rpe: 8.5,
  revision: 3,
  volume: 640,
};
const session: Session = {
  id: "session",
  date: "2026-10-04",
  durationMinutes: 45,
  notes: "Buổi thử",
  startTime: null,
  endTime: null,
  mood: 4,
  bodyWeight: 65,
  revision: 2,
  sets: [row],
  volume: 640,
};
const report: Report = {
  from: "2026-09-05",
  to: "2026-10-04",
  exerciseId: null,
  stats: {
    weekSessions: 2,
    monthSessions: 2,
    rangeSessions: 2,
    averageReps: 8,
    totalMinutes: 90,
    averageMinutes: 45,
    lastVolume: 640,
    frequencyPerWeek: 0.47,
  },
  volume: [{ sessionId: "session", date: session.date, volume: 640 }],
  repDistribution: [
    { name: "Nặng", range: "1–5 rep", count: 1, percent: 25 },
    { name: "Vừa", range: "6–12 rep", count: 2, percent: 50 },
    { name: "Nhẹ", range: "13+ rep", count: 1, percent: 25 },
  ],
  progress: [
    { sessionId: "session", date: session.date, maxWeight: 80, oneRM: 101.33 },
  ],
  prs: [],
  bests: [],
  comparison: {
    current: { sessions: 2, volume: 1000, averageReps: 8 },
    previous: { sessions: 1, volume: 500, averageReps: 5 },
    delta: { sessions: 1, volume: 500, averageReps: 3 },
  },
  weeklyGoal: { target: 4, done: 2, progress: 50 },
  body: [],
  latest: session,
  continueFrom: session,
};
function mount(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}
function form(dialog: FitnessDialog, onClose = vi.fn(), onSession = vi.fn()) {
  return mount(
    <FitnessForm
      dialog={dialog}
      exercises={exercises}
      onClose={onClose}
      onSession={onSession}
    />,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().setSession("token", {
    id: "minh",
    name: "Minh",
    email: "m@f.local",
    coupleId: "couple",
    avatar: null,
    timezone: "Asia/Ho_Chi_Minh",
    createdAt: "2026-10-04T00:00:00Z",
  });
  vi.spyOn(apiClient, "get").mockImplementation(async (path) => ({
    data:
      path === "/exercises"
        ? { items: exercises }
        : path === "/fitness/stats"
          ? report
          : path.startsWith("/fitness/last/")
            ? { sets: [row], date: session.date }
            : path === "/workout-sessions/session"
              ? session
              : path === "/workout-sessions"
                ? { items: [session], total: 1, page: 1, limit: 20 }
                : { items: [], total: 0, page: 1, limit: 20 },
  }));
  vi.spyOn(apiClient, "post").mockResolvedValue({ data: session });
  vi.spyOn(apiClient, "put").mockResolvedValue({ data: session });
  vi.spyOn(apiClient, "delete").mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());
it("new session saves optional values and opens the created session", async () => {
  const close = vi.fn(),
    opened = vi.fn();
  form({ kind: "session" }, close, opened);
  fireEvent.change(screen.getByLabelText("Ngày"), {
    target: { value: "2026-10-04" },
  });
  fireEvent.change(screen.getByLabelText("Thời gian (phút)"), {
    target: { value: "50" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/workout-sessions",
      expect.objectContaining({
        date: "2026-10-04",
        durationMinutes: 50,
        mood: null,
        bodyWeight: null,
        startTime: null,
        endTime: null,
      }),
    ),
  );
  expect(opened).toHaveBeenCalledWith("session");
  expect(close).toHaveBeenCalledOnce();
});
it("editing session sends revision and does not call created callback", async () => {
  const opened = vi.fn();
  form({ kind: "session", session }, vi.fn(), opened);
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith(
      "/workout-sessions/session",
      expect.objectContaining({ revision: 2, mood: 4, bodyWeight: 65 }),
    ),
  );
  expect(opened).not.toHaveBeenCalled();
});
it("one-sided optional time cannot submit a workout", async () => {
  form({ kind: "session" });
  fireEvent.change(screen.getByLabelText("Bắt đầu"), {
    target: { value: "2026-10-04T12:00" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(
    await screen.findByText("Nhập đủ giờ bắt đầu và kết thúc."),
  ).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it("new set autofills previous kg/rep and leaves sequence allocation to server", async () => {
  form({ kind: "set", sessionId: "session" });
  await waitFor(() =>
    expect(screen.getByLabelText("Trọng lượng (kg)")).toHaveValue(80),
  );
  expect(screen.getByLabelText("Số rep")).toHaveValue(8);
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/workout-sets", {
      sessionId: "session",
      exerciseId: "bench",
      weight: 80,
      reps: 8,
      done: true,
      setType: "working",
      rpe: null,
    }),
  );
});
it("late autofill does not overwrite user input", async () => {
  let resolve!: (v: unknown) => void;
  vi.mocked(apiClient.get).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  form({ kind: "set", sessionId: "session" });
  await userEvent.clear(screen.getByLabelText("Trọng lượng (kg)"));
  await userEvent.type(screen.getByLabelText("Trọng lượng (kg)"), "90");
  await act(async () => resolve({ data: { sets: [row] } }));
  expect(screen.getByLabelText("Trọng lượng (kg)")).toHaveValue(90);
  expect(screen.getByLabelText("Số rep")).toHaveValue(8);
});
it("copy and edit retain set fields without triggering autofill", async () => {
  form({ kind: "set", sessionId: "session", set: row });
  expect(apiClient.get).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith(
      "/workout-sets/set",
      expect.objectContaining({
        revision: 3,
        weight: 80,
        rpe: 8.5,
        setType: "working",
      }),
    ),
  );
});
it("blank body measurements are blocked; cm-only measurements can save", async () => {
  form({ kind: "body" });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(
    screen.getByText("Nhập cân nặng hoặc ít nhất một số đo."),
  ).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("Eo (cm)"), "75");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/body-metrics",
      expect.objectContaining({ waist: 75, weight: null }),
    ),
  );
});
it("template must contain sets and saves provided session snapshot", async () => {
  form({
    kind: "template",
    items: [
      {
        exerciseId: "bench",
        weight: 80,
        reps: 8,
        setType: "working",
        rpe: 8.5,
      },
    ],
  });
  await userEvent.type(screen.getByLabelText("Tên"), "Push");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      "/workout-templates",
      expect.objectContaining({
        name: "Push",
        items: [
          {
            exerciseId: "bench",
            weight: 80,
            reps: 8,
            setType: "working",
            rpe: 8.5,
          },
        ],
      }),
    ),
  );
});
it("goal form edits weekly target", async () => {
  form({ kind: "goal", target: 4 });
  fireEvent.change(screen.getByLabelText("Số buổi mỗi tuần"), {
    target: { value: "3" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith("/fitness/goal", {
      sessionsPerWeek: 3,
    }),
  );
});
it("analytics shows actual bucket counts/goal and exercise filter queries a single exercise", async () => {
  mount(<FitnessPage />);
  expect(await screen.findByText("2 set · 50%")).toBeInTheDocument();
  expect(screen.getByLabelText("Tiến độ tuần")).toHaveAttribute("value", "50");
  expect(screen.getByText(/Chọn một bài tập trong bộ lọc/)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Lọc bài tập"), "bench");
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith("/fitness/stats", {
      params: expect.objectContaining({ exerciseId: "bench", range: "30d" }),
    }),
  );
  expect(await screen.findByText(/1RM ước tính Epley/)).toBeInTheDocument();
});
it("set completion and copy send correct revision/data from persisted workout", async () => {
  mount(<FitnessPage />);
  await userEvent.click(screen.getByRole("tab", { name: "Buổi tập" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Ghi / xem set" }),
  );
  await userEvent.click(
    await screen.findByLabelText("Hoàn thành Bench Press set 1"),
  );
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith("/workout-sets/set", {
      done: false,
      revision: 3,
    }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Sao chép set" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/workout-sets", {
      sessionId: "session",
      exerciseId: "bench",
      weight: 80,
      reps: 8,
      setType: "working",
      rpe: 8.5,
      done: true,
    }),
  );
});
it("delete requires explicit checkbox and sends revision", async () => {
  mount(<FitnessPage />);
  await userEvent.click(screen.getByRole("tab", { name: "Buổi tập" }));
  await userEvent.click(await screen.findByRole("button", { name: "Xóa" }));
  expect(screen.getByRole("button", { name: "Xác nhận xóa" })).toBeDisabled();
  await userEvent.click(screen.getByLabelText("Tôi xác nhận xóa."));
  await userEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await waitFor(() =>
    expect(apiClient.delete).toHaveBeenCalledWith("/workout-sessions/session", {
      data: { revision: 2 },
    }),
  );
});
it("HTTP failure shows error instead of fabricated analytics", async () => {
  vi.mocked(apiClient.get).mockRejectedValue(new Error("Không thể tải"));
  mount(<FitnessPreview />);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText(/buổi tuần này/)).not.toBeInTheDocument();
});
it("rest timer uses elapsed clock, pause/resume and finishes at zero", () => {
  vi.useFakeTimers();
  mount(<RestTimer />);
  fireEvent.change(screen.getByLabelText("Thời gian nghỉ"), {
    target: { value: "10" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu / tiếp tục" }));
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.getByRole("timer")).toHaveTextContent("0:07");
  fireEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.getByRole("timer")).toHaveTextContent("0:07");
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu / tiếp tục" }));
  act(() => vi.advanceTimersByTime(7000));
  expect(screen.getByRole("status")).toHaveTextContent("Hết giờ nghỉ");
  expect(screen.getByRole("timer")).toHaveTextContent("0:00");
});
it("rest timer prevents invalid duration and clears its timer on unmount", () => {
  vi.useFakeTimers();
  const m = mount(<RestTimer />);
  fireEvent.change(screen.getByLabelText("Thời gian nghỉ"), {
    target: { value: "1" },
  });
  expect(
    screen.getByRole("button", { name: "Bắt đầu / tiếp tục" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Thời gian nghỉ"), {
    target: { value: "90" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu / tiếp tục" }));
  m.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("continue suggestion shows completed last-set kg/rep and opens next workout", async () => {
  mount(<FitnessPage />);
  expect(
    await screen.findByText("Bench Press: 80 kg × 8 rep"),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Ghi buổi tiếp theo" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Ghi buổi tập" }),
  ).toBeInTheDocument();
});
it("empty template is blocked before posting", async () => {
  form({ kind: "template" });
  await userEvent.type(screen.getByLabelText("Tên"), "Push");
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  expect(
    await screen.findByText("Thêm ít nhất một set vào mẫu."),
  ).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it("old workout request completion cannot open a dialog after logout", async () => {
  const { clearSession } = await import("../lib/apiClient");
  let resolve!: (v: unknown) => void;
  vi.mocked(apiClient.post).mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const close = vi.fn(),
    opened = vi.fn();
  const view = form({ kind: "session" }, close, opened);
  await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
  await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  view.unmount();
  clearSession();
  await act(async () => resolve({ data: session }));
  expect(opened).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
