import { Link } from 'react-router-dom';
import './IrisMessage.scss';

function IrisMessage() {
  return (
    <div className="iris">
      <Link to="/life" className="iris__back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Camp
      </Link>
      <div className="iris__container">
        <div className="iris__icon">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M24 4c-4 8-12 12-12 24a12 12 0 0024 0c0-12-8-16-12-24z" opacity="0.15" fill="currentColor" />
            <path d="M24 4c-4 8-12 12-12 24a12 12 0 0024 0c0-12-8-16-12-24z" />
            <path d="M24 14c-2 4-6 6-6 12a6 6 0 0012 0c0-6-4-8-6-12z" fill="currentColor" opacity="0.1" />
            <path d="M16 6c-4 6 0 10 8 12" opacity="0.4" />
            <path d="M32 6c4 6 0 10-8 12" opacity="0.4" />
          </svg>
        </div>
        <h1 className="iris__title">Iris Messages</h1>
        <p className="iris__subtitle">Toss a golden drachma into the mist and pray to Iris, goddess of the rainbow.</p>
        <p className="iris__coming-soon">Coming soon</p>
      </div>
    </div>
  );
}

export default IrisMessage;
