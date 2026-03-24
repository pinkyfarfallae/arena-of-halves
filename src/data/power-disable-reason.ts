import { ARENA_ROLE } from '../constants/battle';
import { EFFECT_TAGS } from '../constants/effectTags';
import { POWER_NAMES } from '../constants/powers';

export const NOT_ENOUGH_SKILL_POINT_REASON = 'คะแนนทักษะไม่เพียงพอ';

/** Thai reason shown in power tooltip footer when a power is conditionally disabled. */
export const POWER_DISABLE_REASONS: Record<string, Record<string, string>> = {
  /** Generic: when quota is not enough to use the power. Key not a power name; use NOT_ENOUGH_SKILL_POINT_REASON in UI. */
  NOT_ENOUGH_SKILL_POINT: {
    _: NOT_ENOUGH_SKILL_POINT_REASON,
  },
  // Zeus
  [POWER_NAMES.BEYOND_THE_NIMBUS]: {
    ALREADY_HAS_NIMBUS_INFO: 'ผู้เล่นมีสถานะ "เหนือเมฆครึ้ม" อยู่แล้ว หากใช้ซ้ำจะลบสถานะเดิมและเริ่มต้นนับจำนวนรอบใหม่ที่ 2 รอบเท่านั้น ไม่มีการทบจำนวนรอบเพิ่มเติมแต่อย่างใด',
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
  },
  [POWER_NAMES.JOLT_ARC]: {
    NO_ENEMY_SHOCK: 'ไม่มีศัตรูคนใดติดสถานะช็อตอยู่ในขณะนี้',
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
  },
  [POWER_NAMES.KERAUNOS_VOLTAGE]: {
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
  },
  // Hades
  [POWER_NAMES.DEATH_KEEPER]: {
    NO_DEAD_TEAMMATE: 'ไม่มีเพื่อนร่วมทีมคนใด HP น้อยกว่าหรือเท่ากับ 0 ในขณะนี้',
    ALREADY_USED: 'สถานะผู้รั้งความตายสิ้นสุดลงเนื่องจากได้ทำการคืนชีพให้กับผู้เล่นแล้ว',
  },
  [POWER_NAMES.UNDEAD_ARMY]: {
    MAX_SKELETON_COUNT: 'สามารถมีโครงกระดูกในครอบครองได้สูงสูด 2 ตนเท่านั้น',
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
  },
  [POWER_NAMES.SHADOW_CAMOUFLAGING]: {
    ALREADY_HAS_SHADOW_CAMOUFLAGE_INFO: 'มีสถานะ "เงาพรางตัว" อยู่แล้ว หากใช้ซ้ำจะลบสถานะเดิมและเริ่มต้นนับจำนวนรอบใหม่ที่ 2 รอบเท่านั้น ไม่มีการทบจำนวนรอบเพิ่มเติม',
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
  },
  [POWER_NAMES.SOUL_DEVOURER]: {
    SKELETON_QUOTA_FULL_INFO: 'ขณะนี้โครงกระดูกในครอบครองครอบจำนวนสูงสุดแล้ว ทั้งนี้ ผู้เล่นสามารถเข้าสู่สถานะผู้กลืนวิญญาณได้ตามปกติ',
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
  },
  // Persephone
  [POWER_NAMES.FLORAL_FRAGRANCE]: {
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
    ALL_HEALING_NULLIFIED_INFO: 'ขณะนี้ทุกคนในทีมถูกคำสาป "สูญสิ้นเยียวยา" ทำให้การฟื้นฟู HP จะไม่มีผล',
  },
  [POWER_NAMES.EPHEMERAL_SEASON]: {
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
    ALL_HEALING_NULLIFIED_SPRING_INFO: 'หากเลือก "สารทฤดู" ขณะนี้ทุกคนในทีมถูกคำสาป "สูญสิ้นเยียวยา" การฟื้นฟู HP จากสารทฤดูจะไม่มีผล',
  },
  [POWER_NAMES.POMEGRANATES_OATH]: {
    NOT_ENOUGH_SKILL_POINT: NOT_ENOUGH_SKILL_POINT_REASON,
  },
};

export interface GetDisabledPowersParams {
  activeEffects: Array<{ tag?: string; targetId?: string; powerName?: string }>;
  opposingTeam: Array<{ characterId: string }> | undefined;
  attackerId: string | undefined;
  attackerTeam: string | undefined;
  teamMinionsA: Array<{ masterId?: string }> | undefined;
  teamMinionsB: Array<{ masterId?: string }> | undefined;
  attackerSkeletonCount?: number;
  deadTeammateCount?: number;
  /** Self + alive teammates (for Floral Fragrance, check if everyone is affected by Healing Nullified) */
  attackerAllyIds?: string[];
}

export interface DisabledPowersResult {
  disabledPowerNames: Set<string>;
  disabledPowerReasons: Record<string, string>;
  /** Optional footer for powers that are NOT disabled (e.g. Soul Devourer when skeleton quota full). */
  infoReasons?: Record<string, string>;
}

/**
 * Compute conditionally disabled power names and Thai reasons for tooltip footer.
 * Used by BattleHUD for the power selector (e.g. Jolt Arc when no enemy has shock).
 */
export function getDisabledPowersAndReasons(params: GetDisabledPowersParams): DisabledPowersResult {
  const {
    activeEffects: ae,
    opposingTeam,
    attackerId,
    attackerTeam,
    teamMinionsA,
    teamMinionsB,
    attackerSkeletonCount: attackerSkeletonCountProp,
    deadTeammateCount = 0,
    attackerAllyIds,
  } = params;

  const disabled = new Set<string>();
  const reasons: Record<string, string> = {};

  const enemyIds = new Set(opposingTeam?.map((f) => f.characterId) ?? []);
  const hasEnemyShock = ae.some((e) => e.tag === EFFECT_TAGS.SHOCK && enemyIds.has(e.targetId ?? ''));
  if (!hasEnemyShock) {
    disabled.add(POWER_NAMES.JOLT_ARC);
    reasons[POWER_NAMES.JOLT_ARC] =
      POWER_DISABLE_REASONS[POWER_NAMES.JOLT_ARC]?.NO_ENEMY_SHOCK ?? '';
  }

  const hasDeathKeeper = ae.some(
    (e) => e.targetId === attackerId && e.tag === EFFECT_TAGS.DEATH_KEEPER,
  );
  if (!hasDeathKeeper) {
    disabled.add(POWER_NAMES.DEATH_KEEPER);
    const dkReasons = POWER_DISABLE_REASONS[POWER_NAMES.DEATH_KEEPER];
    reasons[POWER_NAMES.DEATH_KEEPER] =
      deadTeammateCount > 0
        ? (dkReasons?.ALREADY_USED ?? '')
        : (dkReasons?.NO_DEAD_TEAMMATE ?? '');
  }

  const attackerTeamMinions =
    (attackerTeam === ARENA_ROLE.TEAM_A ? teamMinionsA : teamMinionsB) ?? [];
  const skeletonCountFromMinions = Array.isArray(attackerTeamMinions)
    ? attackerTeamMinions.filter((m) => m?.masterId === attackerId).length
    : 0;
  const attackerSkeletonCount =
    attackerSkeletonCountProp ?? skeletonCountFromMinions;
  const infoReasons: Record<string, string> = {};

  const hasBeyondTheNimbus = ae.some(
    (e) => e.targetId === attackerId && e.tag === EFFECT_TAGS.BEYOND_THE_NIMBUS,
  );
  if (hasBeyondTheNimbus) {
    infoReasons[POWER_NAMES.BEYOND_THE_NIMBUS] =
      POWER_DISABLE_REASONS[POWER_NAMES.BEYOND_THE_NIMBUS]?.ALREADY_HAS_NIMBUS_INFO ?? 'มีสถานะอยู่แล้ว ถ้าใช้ซ้ำจะลบสถานะเดิมและเริ่มนับใหม่ ไม่มีการทบจำนวนรอบเข้าไป';
  }

  const hasShadowCamouflaging = ae.some(
    (e) =>
      e.targetId === attackerId &&
      (e.tag === EFFECT_TAGS.SHADOW_CAMOUFLAGING || e.powerName === POWER_NAMES.SHADOW_CAMOUFLAGING),
  );
  if (hasShadowCamouflaging) {
    infoReasons[POWER_NAMES.SHADOW_CAMOUFLAGING] =
      POWER_DISABLE_REASONS[POWER_NAMES.SHADOW_CAMOUFLAGING]?.ALREADY_HAS_SHADOW_CAMOUFLAGE_INFO ?? 'มีสถานะเงาพรางตัวอยู่แล้ว ถ้าใช้ซ้ำจะลบสถานะเดิมและเริ่มนับใหม่ ไม่มีการทบจำนวนรอบเข้าไป';
  }

  if (attackerSkeletonCount >= 2) {
    disabled.add(POWER_NAMES.UNDEAD_ARMY);
    reasons[POWER_NAMES.UNDEAD_ARMY] =
      POWER_DISABLE_REASONS[POWER_NAMES.UNDEAD_ARMY]?.MAX_SKELETON_COUNT ?? '';
    infoReasons[POWER_NAMES.SOUL_DEVOURER] =
      POWER_DISABLE_REASONS[POWER_NAMES.SOUL_DEVOURER]?.SKELETON_QUOTA_FULL_INFO ?? 'ขณะนี้โครงกระดูกเต็มโควต้า แต่สามารถเข้าสถานะผู้กลืนวิญญาณได้ปกติ';
  }

  if (attackerAllyIds && attackerAllyIds.length > 0) {
    const allHealingNullified = attackerAllyIds.every((id) =>
      ae.some((e) => e.targetId === id && e.tag === EFFECT_TAGS.HEALING_NULLIFIED),
    );
    if (allHealingNullified) {
      infoReasons[POWER_NAMES.FLORAL_FRAGRANCE] =
        POWER_DISABLE_REASONS[POWER_NAMES.FLORAL_FRAGRANCE]?.ALL_HEALING_NULLIFIED_INFO ?? 'ขณะนี้ทุกคนในทีมติดสถานะลบล้างการรักษา การฟื้นฟู HP จะไม่มีผล';
      infoReasons[POWER_NAMES.EPHEMERAL_SEASON] =
        POWER_DISABLE_REASONS[POWER_NAMES.EPHEMERAL_SEASON]?.ALL_HEALING_NULLIFIED_SPRING_INFO ?? 'หากเลือก "สารทฤดู" แต่ทุกคนในทีมติดสถานะลบล้างการรักษา การฟื้นฟู HP จากสารทฤดูจะไม่มีผล';
    }
  }

  return { disabledPowerNames: disabled, disabledPowerReasons: reasons, infoReasons };
}
