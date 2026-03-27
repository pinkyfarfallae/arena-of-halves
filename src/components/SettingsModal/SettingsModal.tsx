import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslation } from '../../hooks/useTranslation';
import { LANGUAGE } from '../../constants/language';
import Close from '../../icons/Close';
import FlagGB from './icons/FlagGB';
import FlagTH from './icons/FlagTH';
import './SettingsModal.scss';

interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <>
      <div className="settings-backdrop">
        <div className="settings-modal">
          <div className="settings-modal__header">
            <h3 className="settings-modal__title">{t('SETTINGS')}</h3>
            <button className="settings-modal__close" onClick={onClose}>
              <Close width="15" height="15" />
            </button>
          </div>
          <div className="settings-modal__content">
            <div className="settings-modal__section">
              <label className="settings-modal__label">{t('LANGUAGE')}</label>
              <div className="settings-modal__options">
                <button
                  className={`settings-modal__option ${language === LANGUAGE.ENGLISH ? 'settings-modal__option--active' : ''}`}
                  onClick={() => setLanguage(LANGUAGE.ENGLISH)}
                >
                  <span className="settings-modal__option-flag">
                    <FlagGB />
                  </span>
                  <span className="settings-modal__option-text">English</span>
                </button>
                <button
                  className={`settings-modal__option ${language === LANGUAGE.THAI ? 'settings-modal__option--active' : ''}`}
                  onClick={() => setLanguage(LANGUAGE.THAI)}
                >
                  <span className="settings-modal__option-flag">
                    <FlagTH />
                  </span>
                  <span className="settings-modal__option-text">ภาษาไทย</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SettingsModal;
