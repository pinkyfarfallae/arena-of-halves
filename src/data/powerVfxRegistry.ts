/**
 * Single source of truth for power VFX effects.
 * Used by:
 * - Arena TeamPanel: derives chip props from battle activeEffects via tag + applyTo.
 * - Admin Power VFX Demo: reuses TeamPanel with a synthetic battle (activeEffects only; no phase).
 * Add a new effect in this file only; no need to duplicate in a second file.
 */

import type { ActiveEffect } from '../types/power';
import type { BattleRoom, BattleState, FighterState } from '../types/battle';
import { EFFECT_TAGS, type EffectTag } from '../constants/effectTags';
import { EFFECT_TYPES, MOD_STAT } from '../constants/effectTypes';
import { BATTLE_TEAM, ROOM_STATUS } from '../constants/battle';
import { DEITY } from '../constants/deities';
import type { EffectPip } from '../pages/Arena/components/TeamPanel/MemberChip/MemberChip';
import { POWER_NAMES } from '../constants/powers';
import { EffectSide } from '../pages/AdminManager/pages/PowerVfxDemo/utils/types';
import { EFFECT_SIDE_LABEL } from '../pages/AdminManager/pages/PowerVfxDemo/utils/constants';

/** Chip props that an effect can set (subset of MemberChip props). Keep in sync with MemberChip. */
export interface PowerVfxChipProps {
  hasBeyondNimbus?: boolean;
  isShocked?: boolean;
  hasJoltArcDeceleration?: boolean;
  isEfflorescenceMuse?: boolean;
  hasPomegranateEffect?: boolean;
  isSpiritForm?: boolean;
  isShadowCamouflaged?: boolean;
  hasSoulDevourer?: boolean;
  hasDeathKeeper?: boolean;
  isResurrected?: boolean;
  isResurrecting?: boolean;
  isFragranceWaved?: boolean;
  isHit?: boolean;
  isShockHit?: boolean;
  isKeraunosVoltageHit?: boolean;
  isJoltArcAttackHit?: boolean;
  effectPips?: EffectPip[];
}

export interface PowerVfxEntry {
  id: string;
  label: string;
  side: EffectSide;
  group?: string;
  /** Props to pass to MemberChip when this effect is active (demo) or when derived from battle (Arena). */
  props: PowerVfxChipProps;
  /**
   * If set, Arena TeamPanel will set these props when an activeEffect with this tag
   * applies to the member (see applyTo). Omit for demo-only entries (e.g. hit VFX, resurrecting).
   */
  tag?: EffectTag;
  /** For tag-based effects: who gets the props — target of effect, source, or both. */
  applyTo?: EffectSide | 'both';
  /** If set, demo builds an activeEffect with this modStat (e.g. Shadow Camouflaging). */
  modStat?: string;
}

function shockPip(sourceDeity: string, sourceTheme: [string, string]): EffectPip {
  return {
    powerName: POWER_NAMES.LIGHTNING_SPARK,
    sourceName: EFFECT_SIDE_LABEL.CASTER,
    sourceDeity,
    sourceTheme,
    turnsLeft: 2,
    count: 1,
  };
}

const ZEUS_THEME: [string, string] = ['#87CEEB', '#E0F4FF'];

export const POWER_VFX_EFFECTS: PowerVfxEntry[] = [
  // —— Zeus (tag-based: Arena derives from activeEffects) ——
  {
    id: 'beyond-nimbus-caster',
    label: 'Beyond the Nimbus (caster)',
    side: EFFECT_SIDE_LABEL.CASTER,
    group: DEITY.ZEUS,
    tag: EFFECT_TAGS.BEYOND_THE_NIMBUS,
    applyTo: EFFECT_SIDE_LABEL.CASTER,
    props: { hasBeyondNimbus: true },
  },
  {
    id: 'beyond-nimbus-affected',
    label: 'Beyond the Nimbus (affected → Shocked)',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.ZEUS,
    tag: EFFECT_TAGS.SHOCK,
    applyTo: EFFECT_SIDE_LABEL.TARGET,
    props: { isShocked: true, effectPips: [shockPip(DEITY.ZEUS, ZEUS_THEME)] },
  },
  {
    id: 'lightning-spark-affected',
    label: 'Lightning Spark (affected → Shocked)',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.ZEUS,
    tag: EFFECT_TAGS.SHOCK,
    applyTo: EFFECT_SIDE_LABEL.TARGET,
    props: { isShocked: true, effectPips: [shockPip(DEITY.ZEUS, ZEUS_THEME)] },
  },
  {
    id: 'jolt-arc-deceleration',
    label: 'Jolt Arc Deceleration (affected)',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.ZEUS,
    tag: EFFECT_TAGS.JOLT_ARC_DECELERATION,
    applyTo: EFFECT_SIDE_LABEL.TARGET,
    props: { hasJoltArcDeceleration: true },
  },
  // Demo-only hit VFX (no tag; TeamPanel derives from turn/usedPowerName)
  {
    id: 'jolt-arc-attack',
    label: 'Jolt Arc (hit VFX)',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.ZEUS,
    props: { isJoltArcAttackHit: true }
  },
  {
    id: 'keraunos-voltage',
    label: 'Keraunos Voltage (hit)',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.ZEUS,
    props: { isKeraunosVoltageHit: true }
  },
  {
    id: 'hit',
    label: 'Hit (normal)',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.ZEUS,
    props: { isHit: true }
  },
  {
    id: 'shock-hit',
    label: 'Shock Hit',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.ZEUS,
    props: { isShockHit: true }
  },
  // —— Persephone ——
  {
    id: EFFECT_TAGS.EFFLORESCENCE_MUSE,
    label: 'Efflorescence Muse (caster)',
    side: EFFECT_SIDE_LABEL.CASTER,
    group: DEITY.PERSEPHONE,
    tag: EFFECT_TAGS.EFFLORESCENCE_MUSE,
    applyTo: EFFECT_SIDE_LABEL.CASTER,
    props: { isEfflorescenceMuse: true },
  },
  {
    id: 'pomegranate-caster',
    label: "Pomegranate's Oath (caster)",
    side: EFFECT_SIDE_LABEL.CASTER,
    group: DEITY.PERSEPHONE,
    tag: EFFECT_TAGS.POMEGRANATE_SPIRIT,
    applyTo: EFFECT_SIDE_LABEL.CASTER,
    props: { hasPomegranateEffect: true },
  },
  {
    id: EFFECT_TAGS.POMEGRANATE_SPIRIT,
    label: "Pomegranate's Oath Spirit (affected)",
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.PERSEPHONE,
    tag: EFFECT_TAGS.POMEGRANATE_SPIRIT,
    applyTo: EFFECT_SIDE_LABEL.TARGET,
    props: { isSpiritForm: true },
  },
  { 
    id: EFFECT_TAGS.FLORAL_FRAGRANCE, 
    label: 'Floral Fragrance (affected)', 
    side: EFFECT_SIDE_LABEL.TARGET, 
    group: DEITY.PERSEPHONE, 
    props: { isFragranceWaved: true } 
  },
  // —— Hades ——
  { 
    id: 'shadow-camouflaged', 
    label: 'Shadow Camouflaging (caster)', 
    side: EFFECT_SIDE_LABEL.CASTER, 
    group: DEITY.HADES, 
    modStat: MOD_STAT.SHADOW_CAMOUFLAGED, 
    props: { isShadowCamouflaged: true } 
  },
  {
    id: 'soul-devourer',
    label: 'Soul Devourer (caster)',
    side: EFFECT_SIDE_LABEL.CASTER,
    group: DEITY.HADES,
    tag: EFFECT_TAGS.SOUL_DEVOURER,
    applyTo: EFFECT_SIDE_LABEL.TARGET,
    props: { hasSoulDevourer: true },
  },
  {
    id: 'death-keeper',
    label: 'Death Keeper (caster)',
    side: EFFECT_SIDE_LABEL.CASTER,
    group: DEITY.HADES,
    tag: EFFECT_TAGS.DEATH_KEEPER,
    applyTo: EFFECT_SIDE_LABEL.TARGET,
    props: { hasDeathKeeper: true },
  },
  { 
    id: 'resurrecting', 
    label: 'Death Keeper (resurrecting)', 
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.HADES, 
    props: { isResurrecting: true } 
  },
  {
    id: 'resurrected',
    label: 'Death Keeper (resurrected)',
    side: EFFECT_SIDE_LABEL.TARGET,
    group: DEITY.HADES,
    tag: EFFECT_TAGS.RESURRECTED,
    applyTo: EFFECT_SIDE_LABEL.TARGET,
    props: { isResurrected: true },
  },
];

/** Merge props from multiple effects for the same side (for demo stacking). */
export function mergePropsForSide(
  effects: PowerVfxEntry[],
  side: EffectSide
): PowerVfxChipProps {
  const entries = effects.filter((e) => e.side === side);
  if (entries.length === 0) return {};
  const merged: PowerVfxChipProps = {};
  const effectPips: EffectPip[] = [];
  for (const e of entries) {
    for (const [k, v] of Object.entries(e.props) as [keyof PowerVfxChipProps, unknown][]) {
      if (k === 'effectPips') {
        if (Array.isArray(v)) effectPips.push(...v);
      } else if (v === true) {
        (merged as Record<string, boolean>)[k] = true;
      }
    }
  }
  if (effectPips.length) merged.effectPips = effectPips;
  return merged;
}

/**
 * Effect name for tooltips (e.g. effect pip hover). Strips parenthetical suffix from registry label.
 * Returns undefined if no registry entry has this tag.
 */
export function getEffectDisplayNameForTag(tag: string | undefined): string | undefined {
  if (!tag) return undefined;
  const entry = POWER_VFX_EFFECTS.find((e) => e.tag === tag);
  if (!entry?.label) return undefined;
  return entry.label.replace(/\s*\([^)]*\)\s*$/, '').trim() || entry.label;
}

/**
 * Derive chip props from activeEffects for one character using the registry.
 * Used by TeamPanel so tag-based effects are defined in one place.
 */
export function getTagBasedChipProps(
  activeEffects: ActiveEffect[],
  characterId: string
): PowerVfxChipProps {
  const out: PowerVfxChipProps = {};
  for (const entry of POWER_VFX_EFFECTS) {
    if (!entry.tag && !entry.id) continue;
    const matches = entry.tag && entry.applyTo
      ? (entry.applyTo === EFFECT_SIDE_LABEL.TARGET
        ? activeEffects.some((e) => e.targetId === characterId && e.tag === entry.tag)
        : entry.applyTo === EFFECT_SIDE_LABEL.CASTER
          ? activeEffects.some((e) => e.sourceId === characterId && e.tag === entry.tag)
          : activeEffects.some(
            (e) => (e.targetId === characterId || e.sourceId === characterId) && e.tag === entry.tag
          ))
      : activeEffects.some((e) => e.tag === entry.id && e.targetId === characterId);
    if (matches) {
      for (const [k, v] of Object.entries(entry.props) as [keyof PowerVfxChipProps, unknown][]) {
        // Arena computes effectPips from activeEffects; don't overwrite with static demo pips
        if (k === 'effectPips') continue;
        if (v === true) (out as Record<string, boolean>)[k] = true;
      }
    }
  }
  return out;
}

/**
 * Add activeEffect(s) for one entry so that the effect shows on recipientId (the chip that gets the props).
 * otherId is the other fighter. Demo: left modal → recipient = left fighter; right modal → recipient = right fighter.
 */
function addEffectsForCharacter(
  entry: PowerVfxEntry,
  recipientId: string,
  otherId: string,
  activeEffects: ActiveEffect[],
  idGen: { current: number }
): void {
  if (entry.tag && entry.applyTo) {
    if (entry.applyTo === 'both') {
      activeEffects.push({
        id: `demo-${++idGen.current}`,
        powerName: 'Demo',
        effectType: EFFECT_TYPES.BUFF,
        sourceId: recipientId,
        targetId: otherId,
        value: 0,
        turnsRemaining: 2,
        tag: entry.tag,
      });
    } else if (entry.applyTo === EFFECT_SIDE_LABEL.TARGET) {
      // Chip gets props when e.targetId === characterId → put effect on recipient
      activeEffects.push({
        id: `demo-${++idGen.current}`,
        powerName: 'Demo',
        effectType: EFFECT_TYPES.BUFF,
        sourceId: otherId,
        targetId: recipientId,
        value: 0,
        turnsRemaining: 2,
        tag: entry.tag,
      });
    } else {
      // applyTo 'source': chip gets props when e.sourceId === characterId → self-buff on recipient
      activeEffects.push({
        id: `demo-${++idGen.current}`,
        powerName: 'Demo',
        effectType: EFFECT_TYPES.BUFF,
        sourceId: recipientId,
        targetId: recipientId,
        value: 0,
        turnsRemaining: 2,
        tag: entry.tag,
      });
    }
  } else if (entry.modStat) {
    activeEffects.push({
      id: `demo-${++idGen.current}`,
      powerName: 'Demo',
      effectType: EFFECT_TYPES.BUFF,
      sourceId: recipientId,
      targetId: recipientId,
      value: 0,
      modStat: entry.modStat as ActiveEffect['modStat'],
      turnsRemaining: 2,
    });
  } else if (entry.id && Object.keys(entry.props).length > 0) {
    // Demo-only effects: getTagBasedChipProps matches e.targetId === characterId
    activeEffects.push({
      id: `demo-${++idGen.current}`,
      powerName: 'Demo',
      effectType: EFFECT_TYPES.BUFF,
      sourceId: otherId,
      targetId: recipientId,
      value: 0,
      turnsRemaining: 2,
      tag: entry.id as unknown as EffectTag,
    });
  }
}

/**
 * Build synthetic battle from independent left/right effect choices.
 * Left modal selections → apply to left fighter. Right modal selections → apply to right fighter.
 * Each side may include both caster-type and target-type effects.
 */
export function buildSyntheticBattleFromChoices(
  leftEffectIds: string[],
  rightEffectIds: string[],
  leftId: string,
  rightId: string
): BattleState {
  const activeEffects: ActiveEffect[] = [];
  const idGen = { current: 0 };
  for (const effectId of leftEffectIds) {
    const entry = POWER_VFX_EFFECTS.find((e) => e.id === effectId);
    if (!entry) continue;
    addEffectsForCharacter(entry, leftId, rightId, activeEffects, idGen);
  }
  for (const effectId of rightEffectIds) {
    const entry = POWER_VFX_EFFECTS.find((e) => e.id === effectId);
    if (entry) addEffectsForCharacter(entry, rightId, leftId, activeEffects, idGen);
  }
  const demoVfxKey = [...leftEffectIds, ...rightEffectIds].sort().join(',');
  return {
    turnQueue: [
      { characterId: leftId, team: BATTLE_TEAM.A, speed: 10 },
      { characterId: rightId, team: BATTLE_TEAM.B, speed: 8 },
    ],
    currentTurnIndex: 0,
    roundNumber: 1,
    log: [],
    activeEffects,
    /** When set (demo), TeamPanel uses this as hitEventKey so one-shot hit VFX trigger when selection changes. */
    _demoVfxKey: demoVfxKey,
  } as BattleState;
}

/**
 * Build a minimal battle for the VFX demo so we can reuse TeamPanel.
 * No turn/phase — only activeEffects so tag-based and modStat effects show on the chips.
 */
export function buildSyntheticBattle(
  selectedEntries: PowerVfxEntry[],
  leftId: string,
  rightId: string
): BattleState {
  const activeEffects: ActiveEffect[] = [];
  let idGen = 0;
  for (const entry of selectedEntries) {
    if (entry.tag && entry.applyTo) {
      if (entry.applyTo === 'both') {
        activeEffects.push({
          id: `demo-${++idGen}`,
          powerName: 'Demo',
          effectType: EFFECT_TYPES.BUFF,
          sourceId: leftId,
          targetId: rightId,
          value: 0,
          turnsRemaining: 2,
          tag: entry.tag,
        });
      } else {
        const effectTargetId = entry.applyTo === EFFECT_SIDE_LABEL.TARGET ? rightId : leftId;
        const effectSourceId = entry.side === EFFECT_SIDE_LABEL.CASTER ? leftId : rightId;
        activeEffects.push({
          id: `demo-${++idGen}`,
          powerName: 'Demo',
          effectType: EFFECT_TYPES.BUFF,
          sourceId: effectSourceId,
          targetId: effectTargetId,
          value: 0,
          turnsRemaining: 2,
          tag: entry.tag,
        });
      }
    } else if (entry.modStat) {
      const effectTargetId = entry.side === EFFECT_SIDE_LABEL.CASTER ? leftId : rightId;
      activeEffects.push({
        id: `demo-${++idGen}`,
        powerName: 'Demo',
        effectType: EFFECT_TYPES.BUFF,
        sourceId: effectTargetId,
        targetId: effectTargetId,
        value: 0,
        modStat: entry.modStat as ActiveEffect['modStat'],
        turnsRemaining: 2,
      });
    }
  }
  return {
    turnQueue: [
      { characterId: leftId, team: BATTLE_TEAM.A, speed: 10 },
      { characterId: rightId, team: BATTLE_TEAM.B, speed: 8 },
    ],
    currentTurnIndex: 0,
    roundNumber: 1,
    log: [],
    activeEffects,
  };
}

/**
 * Build a minimal BattleRoom for the VFX demo so we can pass it to <Arena demoRoom={...} />.
 * Includes seasonal effect preview when used with demoSeason.
 * Pads each side with clones so multiple chips show (per leftCount/rightCount).
 */
export function buildSyntheticRoom(
  leftFighter: FighterState,
  rightFighter: FighterState,
  battle: BattleState,
  leftCount: number = 1,
  rightCount: number = 1
): BattleRoom {
  const leftCountClamped = Math.max(1, Math.min(6, Math.floor(leftCount) || 1));
  const rightCountClamped = Math.max(1, Math.min(6, Math.floor(rightCount) || 1));

  function cloneFighter(fighter: FighterState, suffix: string): FighterState {
    return { ...fighter, characterId: `${fighter.characterId}${suffix}` };
  }

  const leftMembers: FighterState[] = [leftFighter];
  for (let i = 1; i < leftCountClamped; i++) {
    leftMembers.push(cloneFighter(leftFighter, `-${i + 1}`));
  }
  const rightMembers: FighterState[] = [rightFighter];
  for (let i = 1; i < rightCountClamped; i++) {
    rightMembers.push(cloneFighter(rightFighter, `-${i + 1}`));
  }

  const leftIds = leftMembers.map((m) => m.characterId);
  const rightIds = rightMembers.map((m) => m.characterId);

  const expandedEffects = [...battle.activeEffects];
  battle.activeEffects.forEach((eff) => {
    if (eff.targetId === rightFighter.characterId) {
      rightIds.forEach((id) => {
        if (id !== rightFighter.characterId) {
          expandedEffects.push({ ...eff, id: `${eff.id}-t-${id}`, targetId: id });
        }
      });
    }
    if (eff.sourceId === leftFighter.characterId) {
      leftIds.forEach((id) => {
        if (id !== leftFighter.characterId) {
          expandedEffects.push({ ...eff, id: `${eff.id}-s-${id}`, sourceId: id });
        }
      });
    }
    if (eff.sourceId === rightFighter.characterId) {
      rightIds.forEach((id) => {
        if (id !== rightFighter.characterId) {
          expandedEffects.push({ ...eff, id: `${eff.id}-s-${id}`, sourceId: id });
        }
      });
    }
    if (eff.targetId === leftFighter.characterId) {
      leftIds.forEach((id) => {
        if (id !== leftFighter.characterId) {
          expandedEffects.push({ ...eff, id: `${eff.id}-t-${id}`, targetId: id });
        }
      });
    }
  });

  const expandedBattle: BattleState = {
    ...battle,
    activeEffects: expandedEffects,
    // Preserve demo replay keys so TeamPanel can pass hitEventKey / shock replay (spread may omit in some envs)
    ...('_demoReplayTargetKey' in battle && { _demoReplayTargetKey: (battle as { _demoReplayTargetKey?: number })._demoReplayTargetKey }),
    ...('_demoVfxKey' in battle && { _demoVfxKey: (battle as { _demoVfxKey?: string })._demoVfxKey }),
    ...('_demoShockHitReplayKey' in battle && { _demoShockHitReplayKey: (battle as { _demoShockHitReplayKey?: number })._demoShockHitReplayKey }),
  } as BattleState;

  return {
    arenaId: 'demo',
    roomName: 'VFX Demo',
    status: ROOM_STATUS.BATTLING,
    teamSize: Math.max(leftCountClamped, rightCountClamped),
    teamA: { members: leftMembers, maxSize: leftCountClamped },
    teamB: { members: rightMembers, maxSize: rightCountClamped },
    viewers: {},
    battle: expandedBattle,
    createdAt: Date.now(),
  };
}
