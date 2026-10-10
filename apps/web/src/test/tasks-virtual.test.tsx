import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VirtualTaskList } from "../features/tasks/components/VirtualTaskList";
import type { Task } from "../features/tasks/types";

function createMockTask(id: string, title: string): Task {
  return {
    id,
    title,
    description: "",
    deadline: null,
    priority: "MEDIUM",
    status: "TODO",
    assignedTo: null,
    createdBy: "user-1",
    creatorName: "Minh",
    coupleId: null,
    kind: "task",
    labels: [],
    checklist: [],
    recurrence: "none",
    completedAt: null,
    sourceTaskId: null,
    revision: 0,
    createdAt: "2026-10-01T00:00:00Z",
    readOnly: false,
  };
}

describe("VirtualTaskList component", () => {
  it("renders normally without virtualization when tasks <= 200", () => {
    const tasks = Array.from({ length: 50 }, (_, i) =>
      createMockTask(`t-${i}`, `Việc số ${i + 1}`),
    );

    render(
      <VirtualTaskList
        tasks={tasks}
        threshold={200}
        render={(task) => (
          <div key={task.id} data-testid="task-item">
            {task.title}
          </div>
        )}
      />,
    );

    expect(screen.queryByTestId("virtual-task-list")).not.toBeInTheDocument();
    const renderedItems = screen.getAllByTestId("task-item");
    expect(renderedItems).toHaveLength(50);
    expect(screen.getByText("Việc số 1")).toBeInTheDocument();
    expect(screen.getByText("Việc số 50")).toBeInTheDocument();
  });

  it("activates virtualization when task count > 200, keeping only visible window in DOM", () => {
    // 250 tasks exceeds threshold of 200
    const tasks = Array.from({ length: 250 }, (_, i) =>
      createMockTask(`t-${i}`, `Việc số ${i + 1}`),
    );

    render(
      <VirtualTaskList
        tasks={tasks}
        threshold={200}
        itemHeight={50}
        overscan={5}
        render={(task) => (
          <div key={task.id} data-testid="task-item">
            {task.title}
          </div>
        )}
      />,
    );

    // Virtual container is active
    const virtualContainer = screen.getByTestId("virtual-task-list");
    expect(virtualContainer).toBeInTheDocument();

    // DOM should NOT contain all 250 items simultaneously
    const renderedItems = screen.getAllByTestId("task-item");
    expect(renderedItems.length).toBeLessThan(250);
    expect(renderedItems.length).toBeGreaterThan(0);

    // Initial window starts at item 1
    expect(screen.getByText("Việc số 1")).toBeInTheDocument();
    // Far-away items (e.g. item 240) are virtualized out
    expect(screen.queryByText("Việc số 240")).not.toBeInTheDocument();
  });
});
