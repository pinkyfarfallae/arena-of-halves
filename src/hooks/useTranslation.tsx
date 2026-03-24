import { useLanguage } from '../contexts/LanguageContext';
import { t as translate, getEffectName, UI_TEXT } from '../constants/translations';
import type { Language } from '../contexts/LanguageContext';

/**
 * Hook for translating UI text throughout the app.
 * 
 * Usage:
 *   const { t, lang } = useTranslation();
 *   <button>{t('CONFIRM')}</button>
 */
export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: keyof typeof UI_TEXT) => {
    return translate(key, language);
  };

  return {
    t,
    lang: language,
    translateEffect: (tag: string) => getEffectName(tag, language),
  };
}

/**
 * Get translated text without using the hook (for non-React contexts).
 * 
 * Usage:
 *   getText('SHOP_TITLE', language)
 */
export function getText(key: keyof typeof UI_TEXT, language: Language): string {
  return translate(key, language);
}
