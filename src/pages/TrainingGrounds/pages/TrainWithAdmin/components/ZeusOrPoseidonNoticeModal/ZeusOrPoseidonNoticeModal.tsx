import React, { useMemo } from 'react';
import { T } from '../../../../../../constants/translationKeys';
import { useTranslation } from '../../../../../../hooks/useTranslation';
import './ZeusOrPoseidonNoticeModal.scss';
import { DEITY_THEMES } from '../../../../../../constants/theme';
import { hexToRgb } from '../../../../../../utils/color';
import { DEITY } from '../../../../../../constants/deities';

interface ZeusOrPoseidonNoticeModalProps {
  deity: typeof DEITY.ZEUS | typeof DEITY.POSEIDON;
  onClose: () => void;
}

export const ZeusOrPoseidonNoticeModal = ({ deity, onClose }: ZeusOrPoseidonNoticeModalProps) => {
  const { t } = useTranslation();

  const title = useMemo(() => {
    switch (deity) {
      case DEITY.ZEUS: return t(T.ZEUS_DIE_CURSED_TITLE);
      case DEITY.POSEIDON: return t(T.POSEIDON_DIE_BLESSED_TITLE);
      default: return '';
    }
  }, [deity, t]);

  const deityTheme = useMemo(() => {
    switch (deity) {
      case DEITY.ZEUS: return DEITY_THEMES.zeus;
      case DEITY.POSEIDON: return DEITY_THEMES.poseidon;
      default: return DEITY_THEMES.zeus;
    }
  }, [deity]);

  return (
    <div className="modal-overlay">
      <div
        className="zeus-or-poseidon-notice-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          '--deity-primary': deityTheme[0],
          '--deity-primary-rgb': hexToRgb(deityTheme[0]),
        } as React.CSSProperties}
      >
        <h2 className="zeus-or-poseidon-notice-modal__title">{title}</h2>
        <div className="zeus-or-poseidon-notice-modal__message">
          {deity === DEITY.ZEUS && t(T.ZEUS_DIE_CURSED_MESSAGE)}
          {deity === DEITY.POSEIDON && t(T.POSEIDON_DIE_BLESSED_MESSAGE)}
        </div>
        <button
          className="zeus-or-poseidon-notice-modal__close-button"
          onClick={onClose}
        >
          {t(T.ROGER_THAT)}
        </button>
      </div>
    </div>
  )
}