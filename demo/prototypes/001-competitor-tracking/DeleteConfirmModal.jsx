import "./DeleteConfirmModal.css";

export default function DeleteConfirmModal({ competitor, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>确认删除</h2>
        <p>确认删除竞对 <strong>{competitor.name}</strong> 吗？此操作无法撤销。</p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>取消</button>
          <button className="btn-confirm-delete" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}
