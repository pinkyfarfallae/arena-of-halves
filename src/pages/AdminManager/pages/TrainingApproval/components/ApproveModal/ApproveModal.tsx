import TrainingPoint from '../../../../../TrainingGrounds/pages/Stats/icons/TrainingPoint';
import './ApproveModal.scss';

interface ApproveModalProps {
  show: boolean;
  approveData: {
    charCount: number;
    tweetCount: number;
    reward: number;
    roleplayers: string[];
    isSolo: boolean;
  } | null;
  onClose: () => void;
  onConfirm: () => void;
}

function ApproveModal({ show, approveData, onClose, onConfirm }: ApproveModalProps) {
  if (!show || !approveData) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Confirm Training Approval</h3>
        <div className="modal-body">
          <div className="modal-summary">
            <div className="modal-summary-item">
              <span className="modal-label">Character Count:</span>
              <span className="modal-value">{approveData.charCount.toLocaleString()}</span>
            </div>
            <div className="modal-summary-item">
              <span className="modal-label">Tweet Count:</span>
              <span className="modal-value">{approveData.tweetCount}</span>
            </div>
            <div className="modal-summary-item modal-summary-item--highlight">
              <span className="modal-label">Training Point Reward:</span>
              <span className="modal-value">
                <TrainingPoint /> +{approveData.reward} TP
              </span>
            </div>
          </div>
          <p className="modal-note">
            This will give +1 Training Point to the trainee and mark the submission as approved.
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
            className="modal-btn modal-btn--confirm"
            onClick={onConfirm}
          >
            Approve Training
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApproveModal;
