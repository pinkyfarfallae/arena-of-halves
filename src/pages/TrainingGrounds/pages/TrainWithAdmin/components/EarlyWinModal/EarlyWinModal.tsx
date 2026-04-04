import React from "react";
import './EarlyWinModal.scss';

export default function EarlyWinModal({handleEarlyWinConfirm}: {handleEarlyWinConfirm: () => void}) {
  return (
    <div className="train-with-admin__modal-overlay">
      <div className="train-with-admin__modal train-with-admin__modal--win">
        <h2 className="train-with-admin__modal-title train-with-admin__modal-title--win">Training Succeeded</h2>
        <p className="train-with-admin__modal-message">
          You've succeeded in 3 targets. <br />
          Congratulations, you can continue.
        </p>
        <button
          className="train-with-admin__modal-button train-with-admin__modal-button--win"
          onClick={handleEarlyWinConfirm}
        >
          Roger that
        </button>
      </div>
    </div>
  );
}