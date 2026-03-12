import { PANEL_SIDE } from '../../../../../constants/battle';
import type { FighterState } from '../../../../../types/battle';

/** Which side the effect modal is shown (left/right half of arena). */
export type EffectModalSide = (typeof PANEL_SIDE)[keyof typeof PANEL_SIDE];

/** Fighter option for the internal fighter list (id + label + fighter). */
export interface FighterOption {
  id: string;
  label: string;
  fighter: FighterState;
}
