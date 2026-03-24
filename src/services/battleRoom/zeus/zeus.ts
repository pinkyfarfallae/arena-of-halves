/**
 * Zeus battleRoom functions: Keraunos Voltage and Jolt Arc.
 */

export {
  effectiveKeraunosStep,
  keraunosTierForTargetId,
  computeKeraunosOrderedTargetIds,
  mergeKeraunosBattleLog,
  applyKeraunosVoltageBoltForTarget,
  selectKeraunosTier2Batch,
  type KeraunosBoltResult,
} from './keraunos-voltage';

export {
  JOLT_ARC_EFFECT_MS,
  getJoltArcOrderedTargetIds,
  applyJoltArcDamagePhase,
} from './jolt-arc';
