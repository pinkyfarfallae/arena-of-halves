export interface CampLocation {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  x: number;
  y: number;
  size?: 'sm' | 'md' | 'lg';
  tags?: string[];
  actionLabels?: string[];
  actionIcons?: string[];
  actionPaths?: string[];
  adminOnly?: boolean;
  /** Optional override for where the info panel should appear relative to the pin */
  panelPlacement?: 'left' | 'right' | 'above' | 'below';
}
