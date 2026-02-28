import type { BattleState, FighterState } from '../../../../types/battle';
import './BattleHUD.scss';

interface Props {
  battle: BattleState;
  teamA: FighterState[];
  teamB: FighterState[];
  myId: string | undefined;
  onSelectTarget: (defenderId: string) => void;
  onResolve: () => void;
}

/** Find a fighter across both teams */
function find(teamA: FighterState[], teamB: FighterState[], id: string): FighterState | undefined {
  return [...teamA, ...teamB].find((f) => f.characterId === id);
}

export default function BattleHUD({ battle, teamA, teamB, myId, onSelectTarget, onResolve }: Props) {
  const { turn, roundNumber, log, winner } = battle;

  const attacker = turn ? find(teamA, teamB, turn.attackerId) : undefined;
  const defender = turn?.defenderId ? find(teamA, teamB, turn.defenderId) : undefined;
  const isMyTurn = turn && turn.attackerId === myId;
  const opposingTeam = turn?.attackerTeam === 'teamA' ? teamB : teamA;
  const targets = opposingTeam.filter((f) => f.currentHp > 0);

  // Auto-resolve after showing the result briefly
  const handleResolve = () => {
    if (turn?.phase === 'resolving') {
      onResolve();
    }
  };

  if (winner) {
    const winTeam = winner === 'teamA' ? teamA : teamB;
    const winNames = winTeam.map((f) => f.nicknameEng).join(' & ');
    return (
      <div className="bhud">
        <div className="bhud__winner">
          <span className="bhud__winner-label">Victory</span>
          <span className="bhud__winner-name">{winNames}</span>
        </div>
      </div>
    );
  }

  if (!turn) return null;

  return (
    <div className="bhud">
      {/* Round & turn indicator */}
      <div className="bhud__bar">
        <span className="bhud__round">Round {roundNumber}</span>
        <div className="bhud__turn-info">
          {attacker && (
            <>
              <span className="bhud__attacker-name">{attacker.nicknameEng}</span>
              <span className="bhud__phase-label">
                {turn.phase === 'select-target' && 'is attacking'}
                {turn.phase === 'resolving' && `attacks ${defender?.nicknameEng ?? '...'}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Target selection — only visible to the current attacker */}
      {isMyTurn && turn.phase === 'select-target' && (
        <div className="bhud__targets">
          <span className="bhud__targets-label">Select target:</span>
          <div className="bhud__targets-list">
            {targets.map((t) => (
              <button
                key={t.characterId}
                className="bhud__target-btn"
                onClick={() => onSelectTarget(t.characterId)}
              >
                {t.image ? (
                  <img className="bhud__target-img" src={t.image} alt="" />
                ) : (
                  <span className="bhud__target-initial">{t.nicknameEng.charAt(0)}</span>
                )}
                <span className="bhud__target-name">{t.nicknameEng}</span>
                <span className="bhud__target-hp">{t.currentHp}/{t.maxHp}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resolving phase — show damage result */}
      {turn.phase === 'resolving' && attacker && defender && (
        <div className="bhud__resolve">
          <div className="bhud__resolve-info">
            <span className="bhud__resolve-atk">{attacker.nicknameEng}</span>
            <span className="bhud__resolve-arrow">&rarr;</span>
            <span className="bhud__resolve-def">{defender.nicknameEng}</span>
            <span className="bhud__resolve-dmg">-{attacker.damage} DMG</span>
          </div>
          <button className="bhud__resolve-btn" onClick={handleResolve}>
            Continue
          </button>
        </div>
      )}

      {/* Waiting for opponent */}
      {!isMyTurn && turn.phase === 'select-target' && (
        <div className="bhud__waiting">
          Waiting for {attacker?.nicknameEng ?? '...'}...
        </div>
      )}

      {/* Battle log */}
      {log.length > 0 && (
        <div className="bhud__log">
          {log.slice(-5).reverse().map((entry, i) => {
            const atkName = find(teamA, teamB, entry.attackerId)?.nicknameEng ?? '???';
            const defName = find(teamA, teamB, entry.defenderId)?.nicknameEng ?? '???';
            return (
              <div className="bhud__log-entry" key={i}>
                <span className="bhud__log-round">R{entry.round}</span>
                <span>{atkName} hit {defName} for {entry.damage} dmg</span>
                {entry.eliminated && <span className="bhud__log-ko">KO!</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
