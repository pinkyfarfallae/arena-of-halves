/**
 * Preset fighters and fighter resolution for Power VFX Demo.
 * Player presets use DEITY_THEMES; NPCs are loaded async via fetchNPCs().
 */

import type { FighterState } from '../../../types/battle';
import type { Theme25 } from '../../../types/character';
import { DEITY_THEMES } from '../../../constants/theme';
import { DEITY } from '../../../constants/deities';
import { SKILL_UNLOCK } from '../../../constants/character';

const DEITIES_WITH_THEMES = [
  DEITY.ZEUS,
  DEITY.POSEIDON,
  DEITY.DEMETER,
  DEITY.ARES,
  DEITY.ATHENA,
  DEITY.APOLLO,
  DEITY.HEPHAESTUS,
  DEITY.APHRODITE,
  DEITY.HERMES,
  DEITY.DIONYSUS,
  DEITY.HADES,
  DEITY.PERSEPHONE,
  DEITY.ARTEMIS,
  DEITY.IRIS,
] as const;

function makeFighter(
  id: string,
  name: string,
  deity: string,
  theme: Theme25
): FighterState {
  return {
    characterId: id,
    nicknameEng: name,
    nicknameThai: name,
    sex: 'other',
    deityBlood: deity as FighterState['deityBlood'],
    theme,
    maxHp: 10,
    currentHp: 10,
    damage: 0,
    attackDiceUp: 0,
    defendDiceUp: 0,
    speed: 5,
    rerollsLeft: 0,
    passiveSkillPoint: SKILL_UNLOCK,
    skillPoint: SKILL_UNLOCK,
    ultimateSkillPoint: '',
    technique: 0,
    quota: 2,
    maxQuota: 3,
    criticalRate: 25,
    powers: [],
  };
}

/** Player preset fighters (by deity theme) for demo. */
export function getPresetFighters(): { id: string; label: string; fighter: FighterState }[] {
  return DEITIES_WITH_THEMES.map((deity) => {
    const key = deity.toLowerCase() as keyof typeof DEITY_THEMES;
    const theme = DEITY_THEMES[key];
    if (!theme) return null;
    return {
      id: `preset-${key}`,
      label: `Player (${deity})`,
      fighter: makeFighter(`preset-${key}`, `Player (${deity})`, deity, theme),
    };
  }).filter(Boolean) as { id: string; label: string; fighter: FighterState }[];
}

/** Apply theme override to a fighter (e.g. chip color override). */
export function fighterWithThemeOverride(
  fighter: FighterState,
  themeKey: string | null
): FighterState {
  if (!themeKey) return fighter;
  const key = themeKey.toLowerCase() as keyof typeof DEITY_THEMES;
  const theme = DEITY_THEMES[key];
  if (!theme) return fighter;
  return { ...fighter, theme };
}

/** Get theme as [primary, secondary] for chip gradient from Theme25. */
export function themeToChipColors(theme: Theme25): [string, string] {
  return [theme[0], theme[20] ?? theme[0]];
}
