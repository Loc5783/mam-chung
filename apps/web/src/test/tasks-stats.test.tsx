import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

import { StatsPanel } from "../features/tasks/components/StatsPanel";
import { useAuthStore } from "../features/auth/store";
import { apiClient } from "../lib/apiClient";
import type { TaskStats } from "../features/tasks/types";

const mockUser = {
  id: "user-1",
  name: "Minh",
  email: "minh@test.com",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: "couple-1",
  createdAt: "2026-10-01T00:00:00Z",
};

const mockStats: TaskStats = {
  completed: {
    today: 3,
    thisWeek: 12,
    thisMonth: 28,
  },
  onTimeRate: 0.85,
  streak: {
    current: 8,
    best: 14,
  },
  byDay: [
    { date: "2026-10-04", completed: 2 },
    { date: "2026-10-05", completed: 1 },
    { date: "2026-10-06", completed: 3 },
    { date: "2026-10-07", completed: 0 },
    { date: "2026-10-08", completed: 2 },
    { date: "2026-10-09", completed: 1 },
    { date: "2026-10-10", completed: 3 },
  ],
  byList: [
    { listId: "l1", name: "Công việc nhà", count: 8, color: "#7E9B57" },
    { listId: "l2", name: "Dự án Mầm", count: 4, color: "#E38FA9" },
  ],
  byPriority: {
    LOW: 2,
    MEDIUM: 6,
    HIGH: 3,
    URGENT: 1,
  },
  couple: {
    members: [
      { userId: "user-1", name: "Minh", completed: 7 },
      { userId: "user-2", name: "Lan", completed: 5 },
    ],
    total: 12,
  },
  lateHabits: [
    { name: "mua-sam", type: "label", lateCount: 4, rate: 0.6 },
    { name: "Đi chợ", type: "list", lateCount: 2, rate: 0.4 },
  ],
};

const emptyStats: TaskStats = {
  completed: { today: 0, thisWeek: 0, thisMonth: 0 },
  onTimeRate: null,
  streak: { current: 0, best: 0 },
  byDay: [
    { date: "2026-10-09", completed: 0 },
    { date: "2026-10-10", completed: 0 },
  ],
  byList: [],
  byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
  couple: {
    members: [
      { userId: "user-1", name: "Minh", completed: 0 },
      { userId: "user-2", name: "Lan", completed: 0 },
    ],
    total: 0,
  },
  lateHabits: [],
};

let queryClient: QueryClient;

function renderWithProviders(ui: React.ReactElement) {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  useAuthStore.getState().setSession("test-token", mockUser);
});

describe("StatsPanel component", () => {
  it("renders KPIs, streak icon, and couple contribution from mock stats", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockStats });

    renderWithProviders(<StatsPanel />);

    await waitFor(() => {
      // On-time rate 85% with 'Rất tốt' badge
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText("Rất tốt")).toBeInTheDocument();

      // Streak: 8 days (current >= 7 -> 🌳)
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("ngày liên tiếp")).toBeInTheDocument();
      expect(screen.getByText(/14 ngày/)).toBeInTheDocument();
      expect(screen.getByText(/Mầm lớn vươn xa 🌳/)).toBeInTheDocument();

      // Completed numbers
      expect(screen.getByText("3")).toBeInTheDocument(); // today
      expect(screen.getByText("12")).toBeInTheDocument(); // thisWeek
      expect(screen.getByText("28")).toBeInTheDocument(); // thisMonth

      // Couple card
      expect(screen.getByTestId("stats-couple-card")).toBeInTheDocument();
      expect(screen.getByText("Đóng góp không gian chung")).toBeInTheDocument();
      expect(screen.getByText("Minh")).toBeInTheDocument();
      expect(screen.getByText("Lan")).toBeInTheDocument();

      // Late habits
      expect(screen.getByText(/# mua-sam/)).toBeInTheDocument();
      expect(screen.getByText(/📁 Đi chợ/)).toBeInTheDocument();
    });
  });

  it("switches range (7d / 30d / 90d) and triggers API call with updated params", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({ data: mockStats });

    renderWithProviders(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Thống kê công việc")).toBeInTheDocument();
    });

    // Default range is 30d
    expect(getSpy).toHaveBeenCalledWith("/tasks/stats", {
      params: { range: "30d", scope: "all" },
    });

    // Click 7 ngày button
    const btn7d = screen.getByRole("button", { name: "7 ngày" });
    fireEvent.click(btn7d);

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith("/tasks/stats", {
        params: { range: "7d", scope: "all" },
      });
    });

    // Click 90 ngày button
    const btn90d = screen.getByRole("button", { name: "90 ngày" });
    fireEvent.click(btn90d);

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith("/tasks/stats", {
        params: { range: "90d", scope: "all" },
      });
    });
  });

  it("switches scope and persists to localStorage, hiding couple card when personal", async () => {
    const getSpy = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({ data: mockStats });

    renderWithProviders(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("stats-couple-card")).toBeInTheDocument();
    });

    // Click Cá nhân
    const btnPersonal = screen.getByRole("button", { name: "Cá nhân" });
    fireEvent.click(btnPersonal);

    await waitFor(() => {
      expect(localStorage.getItem("mam_chung_tasks_stats_scope")).toBe(
        "personal",
      );
      expect(getSpy).toHaveBeenCalledWith("/tasks/stats", {
        params: { range: "30d", scope: "personal" },
      });
      // Couple card must be hidden when scope is personal
      expect(screen.queryByTestId("stats-couple-card")).not.toBeInTheDocument();
    });

    // Click Chung
    const btnShared = screen.getByRole("button", { name: "Chung" });
    fireEvent.click(btnShared);

    await waitFor(() => {
      expect(localStorage.getItem("mam_chung_tasks_stats_scope")).toBe(
        "shared",
      );
      expect(screen.getByTestId("stats-couple-card")).toBeInTheDocument();
    });
  });

  it("renders friendly empty state when all days have 0 completions", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: emptyStats });

    renderWithProviders(<StatsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("stats-empty")).toBeInTheDocument();
      expect(
        screen.getByText("Chưa có dữ liệu thống kê trong khoảng thời gian này"),
      ).toBeInTheDocument();
      expect(screen.getByText("Chưa có việc có hạn")).toBeInTheDocument();
      expect(screen.getByText(/Mầm xanh đang lớn 🌱/)).toBeInTheDocument();
    });
  });

  it("calls onFilterLate when user clicks 'Xem các việc này'", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockStats });
    const filterSpy = vi.fn();

    renderWithProviders(<StatsPanel onFilterLate={filterSpy} />);

    await waitFor(() => {
      expect(screen.getByText(/# mua-sam/)).toBeInTheDocument();
    });

    const filterButtons = screen.getAllByRole("button", {
      name: "Xem các việc này →",
    });
    expect(filterButtons.length).toBe(2);

    fireEvent.click(filterButtons[0]);
    expect(filterSpy).toHaveBeenCalledWith({
      name: "mua-sam",
      type: "label",
      lateCount: 4,
      rate: 0.6,
    });
  });

  it("toggles collapse state when collapsible prop is true", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockStats });

    renderWithProviders(<StatsPanel collapsible defaultCollapsed={true} />);

    // Initially collapsed: top button visible, but cards not in document
    const toggleBtn = screen.getByRole("button", {
      name: "Mở rộng thống kê",
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.queryByText("Tỷ lệ đúng hạn")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText("Tỷ lệ đúng hạn")).toBeInTheDocument();
    });

    // Click to collapse
    const collapseBtn = screen.getByRole("button", {
      name: "Thu gọn thống kê",
    });
    fireEvent.click(collapseBtn);

    expect(screen.queryByText("Tỷ lệ đúng hạn")).not.toBeInTheDocument();
  });
});
