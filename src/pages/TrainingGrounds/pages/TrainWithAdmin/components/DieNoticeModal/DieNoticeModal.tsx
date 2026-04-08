import React, { useMemo } from 'react';
import { T } from '../../../../../../constants/translationKeys';
import { useTranslation } from '../../../../../../hooks/useTranslation';
import './DieNoticeModal.scss';
import { DEITY_THEMES } from '../../../../../../constants/theme';
import { hexToRgb } from '../../../../../../utils/color';

interface DieNoticeModalProps {
  die: 10 | 12 | 20;
  onClose: () => void;
}

export const DieNoticeModal = ({ die, onClose }: DieNoticeModalProps) => {
  const { t } = useTranslation();

  const title = useMemo(() => {
    switch (die) {
      case 10: return t(T.HYPNOS_DIE_CURSED_TITLE);
      case 20: return t(T.TYCHE_DIE_BLESSED_TITLE);
      default: return '';
    }
  }, [die, t]);

  const deityTheme = useMemo(() => {
    switch (die) {
      case 10: return DEITY_THEMES.hypnos;
      case 20: return DEITY_THEMES.tyche;
      default: return DEITY_THEMES.zeus;
    }
  }, [die]);

  return (
    <div className="modal-overlay">
      <div
        className="die-notice-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          '--deity-primary': deityTheme[0],
          '--deity-primary-rgb': hexToRgb(deityTheme[0]),
        } as React.CSSProperties}
      >
        <h2 className="die-notice-modal__title">{title}</h2>
        <div className="die-notice-modal__message">
          {die === 10 && t(T.HYPNOS_DIE_CURSED_MESSAGE)}
          {die === 20 && t(T.TYCHE_DIE_BLESSED_MESSAGE)}
        </div>
        <button
          className="die-notice-modal__close-button"
          onClick={onClose}
        >
          {t(T.ROGER_THAT)}
        </button>
      </div>
    </div>
  )
}