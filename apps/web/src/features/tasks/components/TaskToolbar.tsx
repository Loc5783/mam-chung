import React from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "../../../components/ui";
import { TemplatePicker } from "./TemplatePicker";
import { moveTabFocus } from "../../../components/ui/tabs";

export function TaskToolbar({
  view,
  onViewChange,
  listId,
  readOnly,
  online,
  hasCouple,
  isShoppingKind,
  onToggleShopping,
  onSelectTemplateList,
}: {
  view: string;
  onViewChange: (view: string) => void;
  listId: string;
  readOnly: boolean;
  online: boolean;
  hasCouple: boolean;
  isShoppingKind: boolean;
  onToggleShopping: () => void;
  onSelectTemplateList: (id: string) => void;
}) {
  return (
    <div className="task-toolbar">
      <div
        className="task-view-tabs"
        role="tablist"
        onKeyDown={moveTabFocus}
        aria-label="Cách xem"
      >
        <button
          role="tab"
          aria-selected={view === "list"}
          tabIndex={view === "list" ? 0 : -1}
          onClick={() => onViewChange("list")}
        >
          Danh sách
        </button>
        <button
          role="tab"
          aria-selected={view === "kanban"}
          tabIndex={view === "kanban" ? 0 : -1}
          onClick={() => onViewChange("kanban")}
        >
          Kanban
        </button>
        {[
          ["calendar", "Lịch"],
          ["focus", "Focus"],
          ["stats", "Thống kê"],
        ].map(([k, name]) => (
          <button
            key={k}
            role="tab"
            aria-selected={view === k}
            tabIndex={view === k ? 0 : -1}
            onClick={() => onViewChange(k)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="task-toolbar-actions">
        <TemplatePicker
          listId={listId}
          disabled={!online || readOnly}
          onList={onSelectTemplateList}
        />
        <Button
          className={`button-outline ${isShoppingKind ? "is-active" : ""}`}
          disabled={!hasCouple}
          onClick={onToggleShopping}
        >
          <ShoppingBag size={17} />
          Mua sắm chung
        </Button>
      </div>
    </div>
  );
}
