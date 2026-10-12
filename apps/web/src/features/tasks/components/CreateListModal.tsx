import React, { useState } from "react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui";
import { apiClient, errorMessage } from "../../../lib/apiClient";
import { useTaskMutation } from "../api";

export function CreateListModal({
  onClose,
  hasCouple,
  online,
}: {
  onClose: () => void;
  hasCouple: boolean;
  online: boolean;
}) {
  const [listName, setListName] = useState("");
  const [listType, setListType] = useState("normal");
  const [listScope, setListScope] = useState("personal");
  const [listColor, setListColor] = useState("#7E9B57");

  const createList = useTaskMutation(
    async () =>
      apiClient.post("/task-lists", {
        name: listName.trim(),
        scope: listScope,
        type: listType,
        color: listColor,
        icon: listScope === "shared" ? "Heart" : "ListTodo",
      }),
    onClose,
  );

  return (
    <Modal
      title="Danh sách mới"
      onClose={onClose}
      busy={createList.isPending}
    >
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (listName.trim() && online) createList.mutate();
        }}
      >
        <label>
          Loại danh sách
          <select
            aria-label="Loại danh sách"
            value={listType}
            onChange={(e) => setListType(e.target.value)}
          >
            <option value="normal">Công việc</option>
            <option value="shopping">Mua sắm</option>
          </select>
        </label>
        <label>
          Tên danh sách
          <input
            aria-label="Tên danh sách"
            maxLength={80}
            value={listName}
            onChange={(e) => setListName(e.target.value)}
          />
        </label>
        <label>
          Không gian
          <select
            aria-label="Không gian danh sách"
            value={listScope}
            onChange={(e) => setListScope(e.target.value)}
          >
            <option value="personal">Cá nhân</option>
            <option value="shared" disabled={!hasCouple}>
              Chung
            </option>
          </select>
        </label>
        <label>
          Màu danh sách
          <select
            aria-label="Màu danh sách"
            value={listColor}
            onChange={(e) => setListColor(e.target.value)}
          >
            <option value="#7E9B57">Xanh cốm</option>
            <option value="#57713A">Xanh đậm</option>
            <option value="#E38FA9">Hồng</option>
            <option value="#B3577A">Hồng đậm</option>
            <option value="#75806B">Xám</option>
          </select>
        </label>
        {createList.isError && (
          <p role="alert" className="form-error">
            {errorMessage(createList.error)}
          </p>
        )}
        <Button disabled={!listName.trim() || createList.isPending || !online}>
          Tạo danh sách
        </Button>
      </form>
    </Modal>
  );
}
