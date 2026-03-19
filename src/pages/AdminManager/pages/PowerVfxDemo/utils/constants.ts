/**
 * Constants for Power VFX Demo.
 * Use these instead of magic strings/literals in PowerVfxDemo and EffectStackModal.
 */

import { DEITY } from "../../../../../constants/deities";

/** Deity value for "Hades and Persephone" (dual deity); used to allow both Hades and Persephone effect groups. */
export const DEITY_HADES_AND_PERSEPHONE = 'Hades and Persephone' as const;

/** Effect group label when entry has no group. */
export const EFFECT_GROUP_OTHER = 'Other';

/** Fighter dropdown group labels. */
export const FIGHTER_OPTION_GROUP = {
  PLAYER: 'Player',
  NPC: 'NPC',
} as const;

/** Bar side titles (Left / Right). */
export const SIDE_LABEL = {
  LEFT: 'Left',
  RIGHT: 'Right',
} as const;

/** Caster/target labels. */
export const EFFECT_SIDE_LABEL = {
  CASTER: 'Caster',
  TARGET: 'Target',
} as const;

/** Placeholder text for dropdowns. */
export const PLACEHOLDER = {
  FIGHTER: 'Fighter',
  NONE: 'None',
  SEASON: 'Season',
} as const;

/** Effect stack modal titles. */
export const MODAL_TITLE = {
  LEFT_EFFECTS: 'Left effects',
  RIGHT_EFFECTS: 'Right effects',
} as const;

/** State messages when loading or empty. */
export const STATE_MESSAGE = {
  LOADING_FIGHTERS: 'Loading fighters...',
  NO_MEMBERS_OR_NPCS: 'No members or NPCs found.',
  LOADING: 'Loading...',
} as const;

/** Button labels in the bar. */
export const BUTTON_LABEL = {
  EFFECTS: 'Effects',
  REPLAY: 'Replay',
} as const;

/** When deity is Hades and Persephone, allow both effect groups. */
export const ALLOWED_GROUPS_HADES_AND_PERSEPHONE: readonly [string] = [DEITY.PERSEPHONE];

/** CSS custom properties copied from theme source to portaled modal. */
export const CI_THEME_VARS = [
  '--ci-border',
  '--ci-muted',
  '--ci-primary',
  '--ci-primary-hover',
  '--ci-accent',
  '--ci-bg',
  '--ci-fg',
  '--ci-surface',
  '--ci-surface-hover',
  '--ci-light',
] as const;
