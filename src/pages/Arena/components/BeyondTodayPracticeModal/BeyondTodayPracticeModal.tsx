import React, { CSSProperties } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import { useAuth } from '../../../../hooks/useAuth';
import { isNearWhite, contrastText } from '../../../../utils/color';
import { DEITY_THEMES } from '../../../../data/characters';
import './BeyondTodayPracticeModal.scss';

export const BeyondTodayPracticeModal = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="modal-overlay">
      <div
        className="beyond-today-practice-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          '--primary-color': (!isNearWhite(user?.theme[0]) ? user?.theme[0] : undefined) || DEITY_THEMES[user?.deityBlood?.toLowerCase() as any]?.[0] || '#000',
          '--text-color': contrastText((!isNearWhite(user?.theme[0]) ? user?.theme[0] : undefined) || DEITY_THEMES[user?.deityBlood?.toLowerCase() as any]?.[0] || '#000'),
        } as CSSProperties}
      >
        <h2 className="beyond-today-practice-modal-title">{t(T.BEYOND_TODAY_PRACTICE_TITLE)}</h2>
        <p className="beyond-today-practice-modal-message">
          {t(T.BEYOND_TODAY_PRACTICE_MESSAGE)}
        </p>
        <button className="beyond-today-practice-modal-btn" onClick={onClose}>
          {t(T.ROGER_THAT)}
        </button>
      </div>
    </div>
  );
};

export default BeyondTodayPracticeModal;