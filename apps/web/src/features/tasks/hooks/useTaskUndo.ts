import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../../../lib/apiClient";
import { useTaskMutation } from "../api";
import type { Task, Status } from "../types";
import type { useTaskWrite } from "../useTaskWrite";

export type SingleUndoState = {
  task: Task;
  status?: Status;
  restore?: boolean;
} | null;

export type BulkUndoState = {
  items: {
    id: string;
    revision: number;
    restore?: boolean;
    changes?: Record<string, unknown>;
  }[];
} | null;

export function useTaskUndo(writeMutate: ReturnType<typeof useTaskWrite>["mutate"]) {
  const [undo, setUndo] = useState<SingleUndoState>(null);
  const [bulkUndo, setBulkUndo] = useState<BulkUndoState>(null);

  const undoBulkMutation = useTaskMutation(
    async () => apiClient.patch("/tasks/bulk-undo", bulkUndo),
    () => setBulkUndo(null),
  );

  useEffect(() => {
    if (!bulkUndo) return;
    const timer = setTimeout(() => setBulkUndo(null), 5000);
    return () => clearTimeout(timer);
  }, [bulkUndo]);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(timer);
  }, [undo]);

  const triggerSingleUndo = useCallback(() => {
    if (!undo) return;
    writeMutate({
      task: undo.task,
      status: undo.status,
      restore: undo.restore,
    });
    setUndo(null);
  }, [undo, writeMutate]);

  const triggerBulkUndo = useCallback(() => {
    if (bulkUndo && !undoBulkMutation.isPending) {
      undoBulkMutation.mutate();
    }
  }, [bulkUndo, undoBulkMutation]);

  const dismissSingleUndo = useCallback(() => setUndo(null), []);
  const dismissBulkUndo = useCallback(() => setBulkUndo(null), []);

  return {
    undo,
    setUndo,
    bulkUndo,
    setBulkUndo,
    undoBulkMutation,
    triggerSingleUndo,
    triggerBulkUndo,
    dismissSingleUndo,
    dismissBulkUndo,
  };
}
