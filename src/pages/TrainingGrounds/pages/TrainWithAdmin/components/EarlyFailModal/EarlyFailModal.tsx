import React from "react";
import './EarlyFailModal.scss';

export default function EarlyFailModal({handleEarlyFailConfirm, disabled = false}: {handleEarlyFailConfirm: () => void, disabled?: boolean}) {
  return (
    <div className="train-with-admin__modal-overlay">
      <div className="train-with-admin__modal train-with-admin__modal--fail">
        <h2 className="train-with-admin__modal-title train-with-admin__modal-title--fail">Training Failed</h2>
        <p className="train-with-admin__modal-message">
          You've failed 3 targets. <br />
          Unfortunately, you cannot continue.
        </p>
        <button
          className="train-with-admin__modal-button train-with-admin__modal-button--fail"
          onClick={handleEarlyFailConfirm}
          disabled={disabled}
        >
          {disabled ? 'Processing...' : 'Roger that'}
        </button>
      </div>
    </div>
  );
}