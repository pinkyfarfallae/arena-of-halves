/**
 * Hades battleRoom functions: Shadow Camouflage, Soul Devourer, Death Keeper resurrection.
 */

export {
  hasShadowCamouflage,
  advanceAfterShadowCamouflageD4,
} from './shadow-camouflage';

export {
  hasSoulDevourerEffect,
  powerCanAttack,
  advanceAfterSoulDevourerHealSkippedAck,
} from './soul-devourer';

export {
  applySelfResurrect,
  applyImmediateResurrection,
  advanceAfterResurrection,
} from './resurrection';
