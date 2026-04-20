import React from 'react';
import './NoticeModal.scss';

interface NoticeModalProps {
  title: string;
  message: string;
  onClose: () => void;
}

export const NoticeModal = ({ title, message, onClose }: NoticeModalProps) => {
  return (
    <div className="training-stats__notice-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="training-stats-notice-title">
      <div className="training-stats__notice-modal">
        <h3 id="training-stats-notice-title" className="training-stats__notice-modal-title">
          {title}
        </h3>
        <p className="training-stats__notice-modal-message">{message}</p>
        <button
          type="button"
          className="training-stats__notice-modal-button"
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
};