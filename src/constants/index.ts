/**
 * Barrel for shared constants. Prefer importing from here when using
 * multiple constant modules (e.g. import { PHASE, POWER_NAMES } from '@/constants').
 */

export {
  PHASE,
  TURN_ACTION,
  ROOM_STATUS,
  ARENA_ROLE,
  PANEL_SIDE,
  getPhaseLabel,
  ARENA_PATH,
  BATTLE_TEAM,
  teamPath,
  type ArenaRole,
  type BattleTeamKey,
  type PanelSide,
} from './battle';

export { EDIT_FIELD_TYPE, type EditFieldType } from './editField';

export { GAME_MODE, COPY_TYPE, type GameMode, type CopyType } from './lobby';

export { IRIS_PHASE, type Phase } from './iris';

export {
  POWER_TYPES,
  POWER_NAMES,
  type PowerType,
  type PowerName,
} from './powers';

export {
  EFFECT_TAGS,
  effectTagToClass,
  type EffectTag,
} from './effectTags';

export {
  EFFECT_TYPES,
  TARGET_TYPES,
  MOD_STAT,
  type EffectTypeValue,
  type TargetTypeValue,
  type ModStatValue,
} from './effectTypes';

export { SKILL_UNLOCK, isSkillUnlocked } from './character';
