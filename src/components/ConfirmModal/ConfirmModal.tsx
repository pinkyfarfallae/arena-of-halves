import { useState } from 'react';
import './ConfirmModal.scss';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };

  return (
    <div className="cm__overlay">
      <div className="cm">
        <h3 className="cm__title">{title}</h3>
        <p className="cm__message">{message}</p>
        <div className="cm__actions">
          <button className="cm__btn cm__btn--cancel" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`cm__btn ${danger ? 'cm__btn--danger' : 'cm__btn--confirm'}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Processing' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
