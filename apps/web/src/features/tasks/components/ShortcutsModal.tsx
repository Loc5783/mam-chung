import { Modal } from "../../../components/ui/Modal";
import { Keyboard, Smartphone } from "lucide-react";

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Hướng dẫn phím tắt & cử chỉ" onClose={onClose}>
      <div className="shortcuts-guide">
        <section className="shortcuts-section">
          <div className="shortcuts-section-header">
            <Keyboard size={16} />
            <b>Phím tắt trên máy tính</b>
          </div>
          <div className="shortcuts-grid">
            <div className="shortcut-item">
              <kbd>N</kbd>
              <span>Thêm việc mới</span>
            </div>
            <div className="shortcut-item">
              <kbd>/</kbd>
              <span>Tìm kiếm công việc</span>
            </div>
            <div className="shortcut-item">
              <kbd>J</kbd> / <kbd>K</kbd>
              <span>Di chuyển lên / xuống</span>
            </div>
            <div className="shortcut-item">
              <kbd>X</kbd>
              <span>Đánh dấu hoàn thành</span>
            </div>
            <div className="shortcut-item">
              <kbd>E</kbd>
              <span>Mở chi tiết công việc</span>
            </div>
            <div className="shortcut-item">
              <kbd>T</kbd>
              <span>Đặt hạn hôm nay</span>
            </div>
            <div className="shortcut-item">
              <kbd>Delete</kbd>
              <span>Xóa công việc</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl</kbd>+<kbd>Z</kbd>
              <span>Hoàn tác thao tác vừa rồi</span>
            </div>
            <div className="shortcut-item">
              <kbd>Esc</kbd>
              <span>Đóng bảng / hộp thoại</span>
            </div>
          </div>
          <p className="shortcut-note">
            * Phím tắt tạm ngắt khi bạn đang gõ văn bản trong các ô nhập.
          </p>
        </section>

        <section className="shortcuts-section">
          <div className="shortcuts-section-header">
            <Smartphone size={16} />
            <b>Cử chỉ trên điện thoại</b>
          </div>
          <div className="gestures-list">
            <div className="gesture-item">
              <span className="gesture-badge gesture-right">
                👉 Vuốt sang phải
              </span>
              <span>Đánh dấu hoàn thành ngay lập tức</span>
            </div>
            <div className="gesture-item">
              <span className="gesture-badge gesture-left">
                👈 Vuốt sang trái
              </span>
              <span>Dời sang ngày mai hoặc xóa công việc</span>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
