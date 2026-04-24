import './RejectModal.scss';

interface RejectModalProps {
  show: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

function RejectModal({ show, reason, onReasonChange, onClose, onConfirm }: RejectModalProps) {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content big-house-reject-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Reject Submission</h3>
        <div className="modal-body">
          <p className="modal-note">Please provide a reason for rejecting this submission:</p>
          <textarea
            className="modal-textarea"
            placeholder="Enter rejection reason..."
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button
            className="modal-btn modal-btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="modal-btn modal-btn--danger"
            onClick={onConfirm}
            disabled={!reason.trim()}
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default RejectModal;
