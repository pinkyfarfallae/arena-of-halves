import Drachma from '../../../../../../icons/Drachma';
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
    <div className="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Confirm Approval</h3>
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
            <div className="modal-summary-item">
              <span className="modal-label">Participants:</span>
              <span className="modal-value">{approveData.roleplayers.length}</span>
            </div>
            <div className="modal-summary-item modal-summary-item--highlight">
              <span className="modal-label">Total Reward:</span>
              <span className="modal-value">
                <Drachma /> {approveData.reward}
                {approveData.isSolo && <span className="modal-badge">+50% Solo</span>}
              </span>
            </div>
          </div>
          <p className="modal-note">
            This will reward {approveData.roleplayers.length} {approveData.roleplayers.length === 1 ? 'character' : 'characters'} and mark the submission as approved.
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
            Confirm Approval
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApproveModal;
