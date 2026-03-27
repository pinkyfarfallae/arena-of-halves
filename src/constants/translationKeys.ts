/**
 * Translation key constants for type-safe translation calls.
 * Use these instead of hardcoded strings: t(T.CONFIRM) instead of t('CONFIRM')
 * 
 * Usage:
 *   import { T } from '../../constants/translationKeys';
 *   const text = t(T.STRAWBERRY_FIELDS);
 */

import { UI_TEXT } from './translations';

type TranslationKey = keyof typeof UI_TEXT;

// Create a const object with all translation keys
export const T = Object.keys(UI_TEXT).reduce((acc, key) => {
  acc[key as TranslationKey] = key as TranslationKey;
  return acc;
}, {} as Record<TranslationKey, TranslationKey>);

// For backwards compatibility, also export individual categories if needed
export const TranslationKeys = T;
