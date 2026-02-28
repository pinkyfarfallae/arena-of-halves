export const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
export type Die = (typeof DICE)[number];

export interface HistoryEntry {
  die: Die;
  result: number;
}

/** Every die renderer component implements this interface */
export interface DieRendererProps {
  rolling: boolean;
  onResult: (n: number) => void;
  onRollEnd: () => void;
  onClick: () => void;
}
