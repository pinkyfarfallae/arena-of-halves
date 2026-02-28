import type { FighterState } from '../../../../types/battle';
import MemberChip from './MemberChip/MemberChip';
import './TeamPanel.scss';

interface Props {
  members: FighterState[];
  side: 'left' | 'right';
}

function buildPanelBg(members: FighterState[]): React.CSSProperties | undefined {
  if (!members.length) return undefined;

  const colors = members.map((m) => m.theme[0]);
  const stops = colors.map(
    (c) => `color-mix(in srgb, ${c} 12%, transparent)`,
  );
  const gradient =
    stops.length === 1
      ? `linear-gradient(180deg, ${stops[0]} 0%, transparent 100%)`
      : `linear-gradient(90deg, ${stops.join(', ')})`;

  return {
    background: `${gradient}`,
  };
}

export default function TeamPanel({ members, side }: Props) {
  return (
    <div
      className={`team-panel team-panel--${side}`}
      data-count={members.length}
      style={buildPanelBg(members)}
    >
      {members.map((m) => (
        <MemberChip key={m.characterId} fighter={m} />
      ))}
    </div>
  );
}
