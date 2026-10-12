import { Modal } from "../../../components/ui/Modal";
import { ViewErrorBoundary } from "../../../components/ui";
import { ShortcutsModal } from "./ShortcutsModal";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { TaskCommentsModal } from "./TaskCommentsModal";
import { DeleteTaskModal } from "./DeleteTaskModal";
import { CreateListModal } from "./CreateListModal";
import { TaskForm } from "../TaskForm";
import { QuickAddBar } from "./QuickAddBar";
import { localInputDate } from "../../finance/api";
import { useFocusStore } from "../store/focus";
import { useUiStore } from "../../../app/store";
import type { Task, TaskList, Members, Status } from "../types";

export function TaskModals({
  shortcuts,
  onCloseShortcuts,
  selectedId,
  selectedTask,
  detailTask,
  members,
  lists,
  isWritePending,
  onCloseDetail,
  onStatusTask,
  onOpenComments,
  onUndoDetail,
  onViewFocus,
  editing,
  onCloseEditing,
  activeList,
  isShoppingKind,
  listReady,
  readOnly,
  comments,
  onCloseComments,
  removing,
  removePending,
  removeError,
  onCloseRemoving,
  onConfirmRemoving,
  creatingList,
  onCloseCreatingList,
  mobileQuick,
  onCloseMobileQuick,
  quickBusy,
  setQuickBusy,
  quickDeadline,
  user,
  hasCouple,
  scope,
  smart,
  listId,
  online,
}: {
  shortcuts: boolean;
  onCloseShortcuts: () => void;
  selectedId: string | null;
  selectedTask: Task | null;
  detailTask?: Task;
  members: Members;
  lists: TaskList[];
  isWritePending: boolean;
  onCloseDetail: () => void;
  onStatusTask: (task: Task, status: Status) => void;
  onOpenComments: (task: Task) => void;
  onUndoDetail?: () => void;
  onViewFocus: () => void;
  editing: Task | true | null;
  onCloseEditing: () => void;
  activeList?: TaskList;
  isShoppingKind: boolean;
  listReady: boolean;
  readOnly: boolean;
  comments: Task | null;
  onCloseComments: () => void;
  removing: Task | null;
  removePending: boolean;
  removeError: unknown;
  onCloseRemoving: () => void;
  onConfirmRemoving: () => void;
  creatingList: boolean;
  onCloseCreatingList: () => void;
  mobileQuick: boolean;
  onCloseMobileQuick: () => void;
  quickBusy: boolean;
  setQuickBusy: (busy: boolean) => void;
  quickDeadline: string | null;
  user: { id: string; name: string; timezone: string };
  hasCouple: boolean;
  scope: string;
  smart: string;
  listId: string;
  online: boolean;
}) {
  const currentDetailTask = detailTask?.id ? detailTask : selectedTask;

  const handleFocus = () => {
    if (!currentDetailTask) return;
    const current = useFocusStore.getState().session;
    if (current && current.taskId !== currentDetailTask.id) {
      useUiStore
        .getState()
        .notify(
          "Bạn đang có một phiên tập trung. Lưu hoặc kết thúc phiên đó trước khi chọn việc khác.",
        );
    } else if (!current) {
      useFocusStore.getState().set({
        userId: user.id,
        taskId: currentDetailTask.id,
        title: currentDetailTask.title,
        phase: "work",
        workMinutes: 25,
        restMinutes: 5,
        elapsedMs: 0,
        runningSince: null,
        sessionId: crypto.randomUUID(),
        pendingSeconds: null,
      });
    }
    onCloseDetail();
    onViewFocus();
  };

  return (
    <>
      {shortcuts && <ShortcutsModal onClose={onCloseShortcuts} />}

      {selectedId && currentDetailTask && (
        <ViewErrorBoundary name="Chi tiết công việc">
          <TaskDetailDrawer
            key={selectedId}
            busy={isWritePending}
            onUndo={onUndoDetail}
            onFocus={handleFocus}
            task={currentDetailTask}
            members={members}
            lists={lists}
            onClose={onCloseDetail}
            onStatus={(s) => onStatusTask(currentDetailTask, s)}
            onComments={() => {
              onCloseDetail();
              onOpenComments(currentDetailTask);
            }}
          />
        </ViewErrorBoundary>
      )}

      {creatingList && (
        <CreateListModal
          onClose={onCloseCreatingList}
          hasCouple={hasCouple}
          online={online}
        />
      )}

      {mobileQuick && (
        <Modal
          title="Thêm nhanh công việc"
          variant="drawer"
          busy={quickBusy}
          onClose={onCloseMobileQuick}
        >
          <div className="todo-mobile-quick-sheet">
            <QuickAddBar
              disabled={!online || !listReady || members.readOnly}
              onBusy={setQuickBusy}
              onAdded={onCloseMobileQuick}
              context={{
                timezone: user.timezone,
                user: { id: user.id, name: user.name },
                members: members.items,
                lists,
                scope:
                  activeList?.coupleId || scope === "shared"
                    ? "shared"
                    : "personal",
                listId: listId || undefined,
                deadline:
                  quickDeadline ??
                  (smart === "today"
                    ? localInputDate(new Date(), user.timezone)
                    : undefined),
              }}
            />
          </div>
        </Modal>
      )}

      {editing && !readOnly && listReady && (
        <TaskForm
          task={editing === true ? undefined : editing}
          members={members}
          shopping={isShoppingKind}
          list={activeList}
          onClose={onCloseEditing}
        />
      )}

      {comments && (
        <TaskCommentsModal task={comments} onClose={onCloseComments} />
      )}

      {removing && (
        <DeleteTaskModal
          task={removing}
          busy={removePending}
          error={removeError}
          onClose={onCloseRemoving}
          onConfirm={onConfirmRemoving}
        />
      )}
    </>
  );
}
