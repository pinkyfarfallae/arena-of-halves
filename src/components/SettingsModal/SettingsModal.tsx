import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslation } from '../../hooks/useTranslation';
import { LANGUAGE } from '../../constants/language';
import CloseIcon from '../../icons/Close';
import './SettingsModal.scss';

interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} />
      <div className="settings-modal">
        <div className="settings-modal__header">
          <h3 className="settings-modal__title">{t('SETTINGS')}</h3>
          <button className="settings-modal__close" onClick={onClose} data-tooltip={t('CLOSE')} data-tooltip-pos="left">
            <CloseIcon width="12" height="12" />
          </button>
        </div>
        <div className="settings-modal__content">
          <div className="settings-modal__section">
            <label className="settings-modal__label">{t('LANGUAGE')}</label>
            <div className="settings-modal__lang-buttons">
              <button
                className={`settings-modal__lang-btn ${language === LANGUAGE.ENGLISH ? 'settings-modal__lang-btn--active' : ''}`}
                onClick={() => setLanguage(LANGUAGE.ENGLISH)}
              >
                English
              </button>
              <button
                className={`settings-modal__lang-btn ${language === LANGUAGE.THAI ? 'settings-modal__lang-btn--active' : ''}`}
                onClick={() => setLanguage(LANGUAGE.THAI)}
              >
                ไทย
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SettingsModal;
