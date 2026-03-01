import type { BattleRoom, BattleLogEntry, FighterState } from '../../../../types/battle';
import Close from '../../../../icons/Close';
import Swords from '../../../../icons/Swords';
import './BattleLogModal.scss';

interface Props {
  room: BattleRoom;
  onClose: () => void;
}

/** Firebase may store arrays as objects with numeric keys — normalise to array. */
function toArray<T>(val: T[] | Record<string, T> | undefined): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

function findFighter(room: BattleRoom, id: string): FighterState | undefined {
  return [...toArray(room.teamA?.members), ...toArray(room.teamB?.members)]
    .find((m) => m.characterId === id);
}

export default function BattleLogModal({ room, onClose }: Props) {
  const log = toArray(room.battle?.log);
  const winner = room.battle?.winner;
  const membersA = toArray(room.teamA?.members);
  const membersB = toArray(room.teamB?.members);
  const teamANames = membersA.map((m) => m.nicknameEng).join(' & ');
  const teamBNames = membersB.map((m) => m.nicknameEng).join(' & ');

  return (
    <div className="blm__overlay" onClick={onClose}>
      <div className="blm" onClick={(e) => e.stopPropagation()}>
        <button className="blm__close" onClick={onClose}>
          <Close width={16} height={16} />
        </button>

        <h2 className="blm__title">
          <Swords width={18} height={18} />
          Battle Log
        </h2>

        <div className="blm__matchup">
          <span className="blm__team">{teamANames}</span>
          <span className="blm__vs">vs</span>
          <span className="blm__team">{teamBNames}</span>
        </div>

        {winner && (
          <div className="blm__winner">
            Winner: {winner === 'teamA' ? teamANames : teamBNames}
          </div>
        )}

        <div className="blm__list">
          {log.length === 0 ? (
            <div className="blm__empty">No log entries.</div>
          ) : log.map((entry: BattleLogEntry, i: number) => {
            const atk = findFighter(room, entry.attackerId);
            const def = findFighter(room, entry.defenderId);
            const atkName = atk?.nicknameEng ?? '???';
            const defName = def?.nicknameEng ?? '???';
            const atkColor = atk?.theme[0];
            const defColor = def?.theme[0];

            return (
              <div className="blm__entry" key={i}>
                <span className="blm__round">R{entry.round}</span>
                <span className="blm__name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="blm__dice">{entry.attackRoll}</span>
                {(atk?.attackDiceUp ?? 0) > 0 && (
                  <span className="blm__bonus">+{atk!.attackDiceUp}</span>
                )}
                <span className="blm__vs-sm">vs</span>
                <span className="blm__name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                <span className="blm__dice">{entry.defendRoll}</span>
                {(def?.defendDiceUp ?? 0) > 0 && (
                  <span className="blm__bonus">+{def!.defendDiceUp}</span>
                )}
                <span className="blm__sep">&mdash;</span>
                {entry.missed ? (
                  <span className="blm__block">Blocked</span>
                ) : (
                  <span className="blm__hit">-{entry.damage} dmg</span>
                )}
                {entry.eliminated && <span className="blm__ko">KO</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
