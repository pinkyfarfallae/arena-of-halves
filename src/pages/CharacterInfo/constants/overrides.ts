import { DEITY } from '../../../constants/deities';
import { CHARACTER } from '../../../constants/characters';

export const DEITY_DISPLAY_OVERRIDES: Record<string, string> = {
  [CHARACTER.ROSABELLA]: DEITY.PERSEPHONE,
  [CHARACTER.BELUGA]: DEITY.NEMESIS,
  [CHARACTER.BONITA]: DEITY.NEMESIS,
};

export const POWER_OVERRIDES: Record<string, string> = {
  [CHARACTER.ROSABELLA]: DEITY.PERSEPHONE,
  [CHARACTER.BELUGA]: DEITY.NYX,
  [CHARACTER.BONITA]: DEITY.HEMERA,
};

