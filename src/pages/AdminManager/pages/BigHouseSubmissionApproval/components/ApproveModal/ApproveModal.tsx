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
    participantRewards: {
      characterId: string;
      name: string;
      charCount: number;
      reward: number;
      bonuses: {
        hasGardeningSet: boolean;
        hasDemeterWish: boolean;
        isSolo: boolean;
      };
    }[];
  } | null;
  isApproving?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ApproveModal({ show, approveData, isApproving, onClose, onConfirm }: ApproveModalProps) {
  if (!show || !approveData) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content big-house-approve-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Confirm Approval</h3>
        <div className="modal-body">
          <div className="modal-summary">
            <div className="modal-summary-item">
              <span className="modal-label">Character Count:</span>
              <span className="modal-value">{approveData.charCount.toLocaleString()}</span>
            </div>
          </div>
          <div className="modal-participants">
            <div className="modal-participants__title">Participant Rewards:</div>
            <div className="modal-participants__list">
              {approveData.participantRewards.map((participant) => (
                <div key={participant.characterId} className="modal-participants__item">
                  <div className="modal-participants__info-container">
                    <div className="modal-participants__info">
                      <span className="modal-participants__name">{participant.name}</span>
                    </div>
                    <span className="modal-participants__reward">
                      <Drachma /> {participant.reward}
                    </span>
                  </div>
                  <div className="modal-participants__bonuses">
                    <span className="modal-badge">
                      Round({participant.charCount.toLocaleString()} ÷ 200 × 7)
                    </span>
                    {participant.charCount > 2400 && (
                      <span className="modal-badge modal-badge--solo">× 2 <span className="modal-badge--gardening-info">&gt;2400 chars</span></span>
                    )}
                    {participant.charCount > 1000 && participant.charCount <= 2400 && (
                      <span className="modal-badge modal-badge--solo">+35 <span className="modal-badge--gardening-info">&gt;1000 chars</span></span>
                    )}
                  </div>
                </div>
              ))}
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
            disabled={isApproving}
          >
            Cancel
          </button>
          <button
            className="modal-btn modal-btn--confirm"
            onClick={onConfirm}
            disabled={isApproving}
          >
            {isApproving ? 'Processing...' : 'Confirm Approval'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApproveModal;
