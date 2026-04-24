import './SuccessModal.scss';

interface SuccessModalProps {
  show: boolean;
  message: string;
}

function SuccessModal({ show, message }: SuccessModalProps) {
  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content--success">
        <div className="modal-success-icon">✓</div>
        <p className="modal-success-message">{message}</p>
      </div>
    </div>
  );
}

export default SuccessModal;
