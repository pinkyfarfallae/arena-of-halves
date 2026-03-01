import type { BattleState, FighterState } from '../../../../types/battle';
import MemberChip from './MemberChip/MemberChip';
import './TeamPanel.scss';

interface Props {
  members: FighterState[];
  side: 'left' | 'right';
  battle?: BattleState;
  myId?: string;
  onSelectTarget?: (defenderId: string) => void;
}

function buildPanelBg(members: FighterState[]): React.CSSProperties | undefined {
  if (!members.length) return undefined;

  const colors = members.map((m) => m.theme[0]);
  const stops = colors.map(
    (c) => `color-mix(in srgb, ${c} 12%, transparent)`,
  );
  const gradient =
    stops.length === 1
      ? `linear-gradient(var(--tp-dir, 180deg), ${stops[0]} 0%, transparent 100%)`
      : `linear-gradient(var(--tp-dir, 90deg), ${stops.join(', ')})`;

  return {
    background: `${gradient}`,
  };
}

export default function TeamPanel({ members, side, battle, myId, onSelectTarget }: Props) {
  const turn = battle?.turn;
  // This panel's team is the opposite side's target pool
  const isOpposingTeam = turn && (
    (side === 'left' && turn.attackerTeam === 'teamB') ||
    (side === 'right' && turn.attackerTeam === 'teamA')
  );
  const canSelectTarget = turn?.phase === 'select-target' && turn.attackerId === myId && isOpposingTeam;

  return (
    <div
      className={`team-panel team-panel--${side}`}
      data-count={members.length}
      style={buildPanelBg(members)}
    >
      {members.map((m) => {
        const isAttacker = turn?.attackerId === m.characterId;
        const isDefender = turn?.defenderId === m.characterId;
        const isEliminated = m.currentHp <= 0;
        const isTargetable = !!(canSelectTarget && !isEliminated);
        const isSpotlight =
          (isAttacker && (turn?.phase === 'select-target' || turn?.phase === 'rolling-attack')) ||
          (isDefender && turn?.phase === 'rolling-defend');

        return (
          <MemberChip
            key={m.characterId}
            fighter={m}
            isAttacker={isAttacker}
            isDefender={isDefender}
            isEliminated={isEliminated}
            isTargetable={isTargetable}
            isSpotlight={!!isSpotlight}
            onSelect={isTargetable && onSelectTarget ? () => onSelectTarget(m.characterId) : undefined}
          />
        );
      })}
    </div>
  );
}
