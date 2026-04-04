import './RejectModal.scss';

interface RejectModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function RejectModal({ show, onClose, onConfirm }: RejectModalProps) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Reject Submission</h3>
        <div className="modal-body">
          <p className="modal-note">
            The task will be marked as rejected and wait for the trainee to resubmit.
            Please provide a reason for rejection to help the trainee improve their submission
            so they can successfully pass the training.
          </p>
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
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default RejectModal;
