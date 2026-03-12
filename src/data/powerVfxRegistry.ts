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

export type VfxSide = 'caster' | 'target';

/** Chip props that an effect can set (subset of MemberChip props). Keep in sync with MemberChip. */
export interface PowerVfxChipProps {
  hasBeyondNimbus?: boolean;
  isShocked?: boolean;
  hasJoltArcDeceleration?: boolean;
  isPetalShielded?: boolean;
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
  side: VfxSide;
  group?: string;
  /** Props to pass to MemberChip when this effect is active (demo) or when derived from battle (Arena). */
  props: PowerVfxChipProps;
  /**
   * If set, Arena TeamPanel will set these props when an activeEffect with this tag
   * applies to the member (see applyTo). Omit for demo-only entries (e.g. hit VFX, resurrecting).
   */
  tag?: EffectTag;
  /** For tag-based effects: who gets the props — target of effect, source, or both. */
  applyTo?: 'target' | 'source' | 'both';
  /** If set, demo builds an activeEffect with this modStat (e.g. Shadow Camouflaging). */
  modStat?: string;
}

function shockPip(sourceDeity: string, sourceTheme: [string, string]): EffectPip {
  return {
    powerName: 'Lightning Spark',
    sourceName: 'Caster',
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
    side: 'caster',
    group: 'Zeus',
    tag: EFFECT_TAGS.BEYOND_THE_NIMBUS,
    applyTo: 'target',
    props: { hasBeyondNimbus: true },
  },
  {
    id: 'beyond-nimbus-affected',
    label: 'Beyond the Nimbus (affected → Shocked)',
    side: 'target',
    group: 'Zeus',
    tag: EFFECT_TAGS.SHOCK,
    applyTo: 'target',
    props: { isShocked: true, effectPips: [shockPip(DEITY.ZEUS, ZEUS_THEME)] },
  },
  {
    id: 'lightning-spark-affected',
    label: 'Lightning Spark (affected → Shocked)',
    side: 'target',
    group: 'Zeus',
    tag: EFFECT_TAGS.SHOCK,
    applyTo: 'target',
    props: { isShocked: true, effectPips: [shockPip(DEITY.ZEUS, ZEUS_THEME)] },
  },
  {
    id: 'jolt-arc-deceleration',
    label: 'Jolt Arc (affected → Deceleration)',
    side: 'target',
    group: 'Zeus',
    tag: EFFECT_TAGS.JOLT_ARC_DECELERATION,
    applyTo: 'target',
    props: { hasJoltArcDeceleration: true },
  },
  // Demo-only hit VFX (no tag; TeamPanel derives from turn/usedPowerName)
  { id: 'jolt-arc-attack', label: 'Jolt Arc (hit VFX)', side: 'target', group: 'Zeus', props: { isJoltArcAttackHit: true } },
  { id: 'keraunos-voltage', label: 'Keraunos Voltage (hit)', side: 'target', group: 'Zeus', props: { isKeraunosVoltageHit: true } },
  { id: 'hit', label: 'Hit (normal)', side: 'target', group: 'Zeus', props: { isHit: true } },
  { id: 'shock-hit', label: 'Shock Hit', side: 'target', group: 'Zeus', props: { isShockHit: true } },
  // —— Persephone ——
  {
    id: 'petal-shielded',
    label: 'Secret of Dryad / Petal Shield (caster)',
    side: 'caster',
    group: 'Persephone',
    tag: EFFECT_TAGS.PETAL_SHIELD,
    applyTo: 'target',
    props: { isPetalShielded: true },
  },
  {
    id: 'pomegranate-caster',
    label: "Pomegranate's Oath (caster)",
    side: 'caster',
    group: 'Persephone',
    tag: EFFECT_TAGS.POMEGRANATE_SPIRIT,
    applyTo: 'source',
    props: { hasPomegranateEffect: true },
  },
  {
    id: 'pomegranate-spirit',
    label: "Pomegranate's Oath / Spirit (affected)",
    side: 'target',
    group: 'Persephone',
    tag: EFFECT_TAGS.POMEGRANATE_SPIRIT,
    applyTo: 'target',
    props: { isSpiritForm: true },
  },
  { id: 'floral-fragrance', label: 'Floral Fragrance (affected)', side: 'target', group: 'Persephone', props: { isFragranceWaved: true } },
  // —— Hades ——
  { id: 'shadow-camouflaged', label: 'Shadow Camouflaging (caster)', side: 'caster', group: 'Hades', modStat: MOD_STAT.SHADOW_CAMOUFLAGED, props: { isShadowCamouflaged: true } },
  {
    id: 'soul-devourer',
    label: 'Soul Devourer (caster)',
    side: 'caster',
    group: 'Hades',
    tag: EFFECT_TAGS.SOUL_DEVOURER,
    applyTo: 'target',
    props: { hasSoulDevourer: true },
  },
  {
    id: 'death-keeper',
    label: 'Death Keeper (caster)',
    side: 'caster',
    group: 'Hades',
    tag: EFFECT_TAGS.DEATH_KEEPER,
    applyTo: 'target',
    props: { hasDeathKeeper: true },
  },
  { id: 'resurrecting', label: 'Death Keeper (resurrecting)', side: 'target', group: 'Hades', props: { isResurrecting: true } },
  {
    id: 'resurrected',
    label: 'Death Keeper (resurrected)',
    side: 'target',
    group: 'Hades',
    tag: EFFECT_TAGS.RESURRECTED,
    applyTo: 'target',
    props: { isResurrected: true },
  },
];

/** Merge props from multiple effects for the same side (for demo stacking). */
export function mergePropsForSide(
  effects: PowerVfxEntry[],
  side: VfxSide
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
      ? (entry.applyTo === 'target'
          ? activeEffects.some((e) => e.targetId === characterId && e.tag === entry.tag)
          : entry.applyTo === 'source'
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
 * otherId is the other fighter (used as source when recipient is target, or target when recipient is source).
 * Demo rule: caster modal → recipient = caster; target modal → recipient = target.
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
    } else if (entry.applyTo === 'target') {
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
 * Left modal selections → apply to caster (left fighter). Right modal selections → apply to target (right fighter).
 * Each side may include both caster-type and target-type effects.
 */
export function buildSyntheticBattleFromChoices(
  casterEffectIds: string[],
  targetEffectIds: string[],
  casterId: string,
  targetId: string
): BattleState {
  const activeEffects: ActiveEffect[] = [];
  const idGen = { current: 0 };
  for (const effectId of casterEffectIds) {
    const entry = POWER_VFX_EFFECTS.find((e) => e.id === effectId);
    if (!entry) continue;
    addEffectsForCharacter(entry, casterId, targetId, activeEffects, idGen);
  }
  for (const effectId of targetEffectIds) {
    const entry = POWER_VFX_EFFECTS.find((e) => e.id === effectId);
    if (entry) addEffectsForCharacter(entry, targetId, casterId, activeEffects, idGen);
  }
  const demoVfxKey = [...casterEffectIds, ...targetEffectIds].sort().join(',');
  return {
    turnQueue: [
      { characterId: casterId, team: BATTLE_TEAM.A, speed: 10 },
      { characterId: targetId, team: BATTLE_TEAM.B, speed: 8 },
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
  casterId: string,
  targetId: string
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
          sourceId: casterId,
          targetId: targetId,
          value: 0,
          turnsRemaining: 2,
          tag: entry.tag,
        });
      } else {
        const effectTargetId = entry.applyTo === 'target' ? targetId : casterId;
        const effectSourceId = entry.side === 'caster' ? casterId : targetId;
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
      const effectTargetId = entry.side === 'caster' ? casterId : targetId;
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
      { characterId: casterId, team: BATTLE_TEAM.A, speed: 10 },
      { characterId: targetId, team: BATTLE_TEAM.B, speed: 8 },
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
 * Pads each side with clones of the selected fighter so multiple chips show (per casterCount/targetCount).
 */
export function buildSyntheticRoom(
  caster: FighterState,
  target: FighterState,
  battle: BattleState,
  casterCount: number = 1,
  targetCount: number = 1
): BattleRoom {
  const casterCountClamped = Math.max(1, Math.min(6, Math.floor(casterCount) || 1));
  const targetCountClamped = Math.max(1, Math.min(6, Math.floor(targetCount) || 1));

  function cloneFighter(fighter: FighterState, suffix: string): FighterState {
    return { ...fighter, characterId: `${fighter.characterId}${suffix}` };
  }

  const casterMembers: FighterState[] = [caster];
  for (let i = 1; i < casterCountClamped; i++) {
    casterMembers.push(cloneFighter(caster, `-${i + 1}`));
  }
  const targetMembers: FighterState[] = [target];
  for (let i = 1; i < targetCountClamped; i++) {
    targetMembers.push(cloneFighter(target, `-${i + 1}`));
  }

  const casterIds = casterMembers.map((m) => m.characterId);
  const targetIds = targetMembers.map((m) => m.characterId);

  const expandedEffects = [...battle.activeEffects];
  battle.activeEffects.forEach((eff) => {
    if (eff.targetId === target.characterId) {
      targetIds.forEach((id) => {
        if (id !== target.characterId) {
          expandedEffects.push({ ...eff, id: `${eff.id}-t-${id}`, targetId: id });
        }
      });
    }
    if (eff.sourceId === caster.characterId) {
      casterIds.forEach((id) => {
        if (id !== caster.characterId) {
          expandedEffects.push({ ...eff, id: `${eff.id}-s-${id}`, sourceId: id });
        }
      });
    }
    if (eff.sourceId === target.characterId) {
      targetIds.forEach((id) => {
        if (id !== target.characterId) {
          expandedEffects.push({ ...eff, id: `${eff.id}-s-${id}`, sourceId: id });
        }
      });
    }
    if (eff.targetId === caster.characterId) {
      casterIds.forEach((id) => {
        if (id !== caster.characterId) {
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
    teamSize: Math.max(casterCountClamped, targetCountClamped),
    teamA: { members: casterMembers, maxSize: casterCountClamped },
    teamB: { members: targetMembers, maxSize: targetCountClamped },
    viewers: {},
    battle: expandedBattle,
    createdAt: Date.now(),
  };
}
