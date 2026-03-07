/**
 * Ephemeral Season power configuration.
 * Each season has a unique color, icon component, and Thai label.
 */

import { lazy } from 'react';
import type { FC } from 'react';

// Lazy load icon components to avoid circular dependency issues
const SunIcon = lazy(() => import('./icons/seasons/SunIcon').then(m => ({ default: m.default })));
const MapleLeafIcon = lazy(() => import('./icons/seasons/MapleLeafIcon').then(m => ({ default: m.default })));
const SnowflakeIcon = lazy(() => import('./icons/seasons/SnowflakeIcon').then(m => ({ default: m.default })));
const RoseIcon = lazy(() => import('./icons/seasons/RoseIcon').then(m => ({ default: m.default })));

/** Season key constants — use instead of string literals (e.g. season === SEASON_KEYS.AUTUMN). */
export const SEASON_KEYS = {
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
  SPRING: 'spring',
} as const;

export type SeasonKey = (typeof SEASON_KEYS)[keyof typeof SEASON_KEYS];

export interface SeasonConfig {
  key: SeasonKey;
  labelTh: string;
  labelEn: string;
  icon: FC; // React component
  color: string; // Primary season color (for gradients and accents)
  colorDark: string; // Darker shade for text/borders
}

export const SEASONS: Record<SeasonKey, SeasonConfig> = {
  [SEASON_KEYS.SUMMER]: {
    key: SEASON_KEYS.SUMMER,
    labelTh: 'ฤดูร้อน',
    labelEn: 'Summer',
    icon: SunIcon,
    color: '#ebc000ff', // Bright yellow
    colorDark: '#e99610ff',
  },
  [SEASON_KEYS.AUTUMN]: {
    key: SEASON_KEYS.AUTUMN,
    labelTh: 'ฤดูใบไม้ร่วง',
    labelEn: 'Autumn',
    icon: MapleLeafIcon,
    color: '#FF9800', // Orange
    colorDark: '#E67E22',
  },
  [SEASON_KEYS.WINTER]: {
    key: SEASON_KEYS.WINTER,
    labelTh: 'ฤดูหนาว',
    labelEn: 'Winter',
    icon: SnowflakeIcon,
    color: '#64B5F6', // Light blue
    colorDark: '#1976D2',
  },
  [SEASON_KEYS.SPRING]: {
    key: SEASON_KEYS.SPRING,
    labelTh: 'ฤดูใบไม้ผลิ',
    labelEn: 'Spring',
    icon: RoseIcon,
    color: '#81C784', // Green
    colorDark: '#388E3C',
  },
};

export const SEASON_ORDER: SeasonKey[] = [SEASON_KEYS.SUMMER, SEASON_KEYS.AUTUMN, SEASON_KEYS.WINTER, SEASON_KEYS.SPRING];

/**
 * Get season config by key
 */
export function getSeasonConfig(key: SeasonKey): SeasonConfig {
  return SEASONS[key as keyof typeof SEASONS];
}

/**
 * Get all seasons in order
 */
export function getAllSeasons(): SeasonConfig[] {
  return SEASON_ORDER.map((key) => SEASONS[key as keyof typeof SEASONS]);
}
