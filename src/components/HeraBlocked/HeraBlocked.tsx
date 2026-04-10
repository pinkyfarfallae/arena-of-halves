import React from "react";
import { useTranslation } from "../../hooks/useTranslation";
import { T } from '../../constants/translationKeys';
import Hera from './images/hera.png';
import "./HeraBlocked.scss";

interface HeraBlockedProps {
  onClose: () => void;
}

const HeraBlocked = ({ onClose }: HeraBlockedProps) => {
  const { t } = useTranslation();
  return (
    <div className="hera-blocked">
      <div className="hera-blocked-overlay" />
      <div className="hera-blocked-overlay hera-blocked-overlay--effect" />
      {/* Rain drops */}
      <div className="hera-blocked-overlay-rain" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className={`hera-blocked-overlay-rain-drop hera-blocked-overlay-rain-drop--${i + 1}`} />
        ))}
      </div>
      <div className="hera-blocked-overlay-drops" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={`hera-blocked-overlay-drop hera-blocked-overlay-drop--${i + 1}`}
          />
        ))}
      </div>
      <div className="hera-blocked-content">
        <div className="hera-blocked-icon">
          <img src={Hera} alt="Hera" />
        </div>
        <h2 className="hera-blocked-title">{t(T.HERA_BLOCKED_TITLE)}</h2>
        <div className="hera-blocked-message">{t(T.HERA_BLOCKED_MESSAGE)}</div>
        <button className="hera-blocked-button" onClick={onClose}>
          {t(T.ROGER_THAT)}
        </button>
      </div>
    </div>
  );
};

export default HeraBlocked;