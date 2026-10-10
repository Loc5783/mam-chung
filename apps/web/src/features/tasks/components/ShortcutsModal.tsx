import { Modal } from "../../../components/ui/Modal";

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Phím tắt công việc" onClose={onClose}>
      <p>
        N: thêm việc · /: tìm kiếm · J/K: lên/xuống · X: hoàn thành · E: chi
        tiết · T: hạn hôm nay · Delete: xóa · Esc: đóng · Ctrl+Z: hoàn tác.
      </p>
      <p>Phím tắt không chạy khi bạn đang nhập nội dung.</p>
    </Modal>
  );
}
