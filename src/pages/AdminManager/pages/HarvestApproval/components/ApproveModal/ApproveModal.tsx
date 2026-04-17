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
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
                    <span className={`modal-badge ${participant.bonuses.hasGardeningSet ? 'modal-badge--gardening' : ''}`}>
                      Ceiling<>(</>({approveData.charCount} ÷ 200) x {participant.bonuses.hasGardeningSet
                        ? <>15 <span className="modal-badge--gardening-info">Gardening Set</span></>
                        : '10'}
                      {(!participant.bonuses.isSolo && !participant.bonuses.hasDemeterWish) && <>)</>}
                    </span>
                    {participant.bonuses.isSolo && (
                      <span className="modal-badge modal-badge--solo">
                        x 1.5 <span className="modal-badge--gardening-info">Solo</span>
                        {!participant.bonuses.hasDemeterWish && <>)</>}
                      </span>

                    )}
                    {participant.bonuses.hasDemeterWish && (
                      <span className="modal-badge modal-badge--wish">x 2 <span className="modal-badge--gardening-info">Demeter Wish</span><>)</></span>
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
