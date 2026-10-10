import React, { useState, useEffect, useRef, useMemo } from "react";
import type { Task } from "../types";

export interface VirtualTaskListProps {
  tasks: Task[];
  render: (task: Task, index: number) => React.ReactNode;
  itemHeight?: number;
  overscan?: number;
  threshold?: number;
  className?: string;
}

/**
 * Lightweight, 0-dependency list virtualization for task lists.
 * Activates only when task count exceeds threshold (default: 200).
 * Maintains smooth 60fps scrolling and keyboard accessibility.
 */
export function VirtualTaskList({
  tasks,
  render,
  itemHeight = 52,
  overscan = 8,
  threshold = 200,
  className = "",
}: VirtualTaskListProps) {
  // If task count is within threshold, render full list directly without virtualization overhead
  if (tasks.length <= threshold) {
    return (
      <div className={`task-list-standard ${className}`.trim()}>
        {tasks.map((task, idx) => render(task, idx))}
      </div>
    );
  }

  return (
    <VirtualContainer
      tasks={tasks}
      render={render}
      itemHeight={itemHeight}
      overscan={overscan}
      className={className}
    />
  );
}

function VirtualContainer({
  tasks,
  render,
  itemHeight,
  overscan,
  className,
}: {
  tasks: Task[];
  render: (task: Task, index: number) => React.ReactNode;
  itemHeight: number;
  overscan: number;
  className: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    };

    const updateHeight = () => {
      if (containerRef.current) {
        setViewportHeight(containerRef.current.clientHeight || 600);
      }
    };

    updateHeight();
    const el = containerRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", updateHeight);
    }

    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const totalCount = tasks.length;
  const totalHeight = totalCount * itemHeight;

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2 * overscan;
    const end = Math.min(totalCount, start + visibleCount);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, viewportHeight, itemHeight, overscan, totalCount]);

  const topSpacerHeight = startIndex * itemHeight;
  const visibleTasks = tasks.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      className={`virtual-task-list max-h-[75vh] overflow-y-auto contain-strict ${className}`.trim()}
      data-testid="virtual-task-list"
      style={{ willChange: "scroll-position" }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${topSpacerHeight}px)`,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleTasks.map((task, offset) =>
            render(task, startIndex + offset),
          )}
        </div>
      </div>
    </div>
  );
}
