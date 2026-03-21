import type { BattleRoom, BattleLogEntry, FighterState } from '../../../../types/battle';
import Close from '../../../../icons/Close';
import Swords from '../../../../icons/Swords';
import './BattleLogModal.scss';
import { BATTLE_TEAM } from '../../../../constants/battle';
import { POWER_NAMES } from '../../../../constants/powers';
import { DEFAULT_THEME } from '../../../../constants/theme';
import { getPowers } from '../../../../data/powers';

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
  // Search main members first
  const members = [...toArray(room.teamA?.members), ...toArray(room.teamB?.members)];
  const found = members.find((m) => m.characterId === id);
  if (found) return found;

  // Fallback: search team-level minions so log entries for minions show proper names
  // @ts-ignore: minions may be stored in different places or legacy formats
  const minionsA = toArray((room.teamA as any)?.minions) as any[];
  const minionsB = toArray((room.teamB as any)?.minions) as any[];
  const allMinions = [...minionsA, ...minionsB];
  const m = allMinions.find((mn) => mn && mn.characterId === id);
  if (m) {
    // Map minion shape to FighterState-like object for display only
    return {
      characterId: m.characterId,
      nicknameEng: m.nicknameEng || m.characterId,
      nicknameThai: m.nicknameThai || m.nicknameEng || m.characterId,
      sex: m.sex || 'unknown',
      deityBlood: m.deityBlood || 'unknown',
      image: m.image,
      theme: m.theme || DEFAULT_THEME[m.deityBlood] || DEFAULT_THEME[0],
      maxHp: m.maxHp || 1,
      currentHp: m.currentHp || 1,
      damage: m.damage || 0,
      attackDiceUp: m.attackDiceUp || 0,
      defendDiceUp: m.defendDiceUp || 0,
      speed: m.speed || 0,
      rerollsLeft: m.rerollsLeft || 0,
      passiveSkillPoint: m.passiveSkillPoint || '',
      skillPoint: m.skillPoint || '',
      ultimateSkillPoint: m.ultimateSkillPoint || '',
      technique: m.technique || 0,
      quota: m.quota || 0,
      maxQuota: m.maxQuota || 0,
      criticalRate: m.criticalRate || 0,
      powers: m.powers || [],
      skeletonCount: undefined,
    } as FighterState;
  }
  return undefined;
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
            Winner: {winner === BATTLE_TEAM.A ? teamANames : teamBNames}
          </div>
        )}

        <div className="blm__list">
          {log.length === 0 ? (
            <div className="blm__empty">No log entries.</div>
          ) : log.map((entry: BattleLogEntry, i: number) => {
            const atk = findFighter(room, entry.attackerId);
            const def = findFighter(room, entry.defenderId);
            const atkName = atk?.nicknameEng ?? entry.attackerName ?? '???';
            const defName = def?.nicknameEng ?? entry.defenderName ?? '???';
            const atkColor = atk?.theme[0] ?? entry.attackerTheme;
            const defColor = def?.theme[0] ?? entry.defenderTheme;

            if (entry.beyondTheNimbus) {
              return (
                <div className="blm__entry blm__entry--nimbus" key={i}>
                  <span className="blm__round">R{entry.round}</span>
                  <span className="blm__name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                  {' '}
                  <span className="blm__power">Beyond the Nimbus</span>
                </div>
              );
            }

            // Compact rendering for minion hits (skeletons): no dice breakdown — single-line text
            if ((entry as any).isMinionHit) {
              return (
                <div className="blm__entry blm__entry--minion" key={i}>
                  <span className="blm__round">R{entry.round}</span>
                  <span className="blm__name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                  <span className="blm__vs-sm">vs</span>
                  <span className="blm__name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                  <span className="blm__sep">&mdash;</span>
                  {entry.missed ? (
                    <span className="blm__block">{atkName} missed {defName}</span>
                  ) : (entry.damage ?? 0) > 0 ? (
                    <span className="blm__hit">{atkName} hit {defName} for <strong>{entry.damage}</strong> dmg</span>
                  ) : (
                    <span className="blm__applied">{atkName} hit {defName}</span>
                  )}
                  {entry.eliminated && <span className="blm__ko">KO</span>}
                </div>
              );
            }

            // Skip (no valid target, e.g. Shadow Camouflage)
            if ((entry as any).skippedNoValidTarget) {
              const reason = (entry as any).skipReason ?? 'No valid target';
              return (
                <div className="blm__entry blm__entry--skip" key={i}>
                  <span className="blm__round">R{entry.round}</span>
                  <span className="blm__skip">Skip turn ({reason})</span>
                </div>
              );
            }

            // Soul Devourer drain: no dice, show drain result
            if ((entry as any).soulDevourerDrain) {
              return (
                <div className="blm__entry blm__entry--power" key={i}>
                  <span className="blm__round">R{entry.round}</span>
                  <span className="blm__name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                  <span className="blm__vs-sm">→</span>
                  <span className="blm__name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                  <span className="blm__sep">&mdash;</span>
                  <span className="blm__hit">-{entry.damage} dmg</span>
                  {(entry as any).soulDevourerHealAmount != null && (
                    <span className="blm__heal">+{(entry as any).soulDevourerHealAmount} heal</span>
                  )}
                  {entry.eliminated && <span className="blm__ko">KO</span>}
                </div>
              );
            }

            // Power entry: "AttackerName PowerName [→ DefenderName] [damage]"
            // Ephemeral Season / self-target: no arrow (log is written after choose season / choose target)
            if (entry.powerUsed) {
              const isSeasonPower = entry.powerUsed === POWER_NAMES.EPHEMERAL_SEASON || entry.powerUsed.startsWith(POWER_NAMES.EPHEMERAL_SEASON + ':');
              const isSelfTarget = entry.defenderId === entry.attackerId;
              const noTarget = isSeasonPower || isSelfTarget;
              const powMeta = atk ? getPowers(atk.deityBlood).find((p) => p.name === entry.powerUsed) : undefined;
              const skipApplied =
                !noTarget &&
                !(entry.damage ?? 0) &&
                !(entry.heal != null && entry.heal > 0) &&
                !entry.isDodged &&
                !entry.missed &&
                !!powMeta?.skipDice;
              return (
                <div className="blm__entry blm__entry--power" key={i}>
                  <span className="blm__round">R{entry.round}</span>
                  <span className="blm__name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                  <span className="blm__power">{entry.powerUsed}</span>
                  {!noTarget && (
                    <>
                      <span className="blm__vs-sm">→</span>
                      <span className="blm__name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                    </>
                  )}
                  {entry.heal != null && entry.heal > 0 ? (
                    <>
                      <span className="blm__sep">&mdash;</span>
                      <span className="blm__heal">
                        +{entry.heal} heal{entry.floralHealCrit ? ' · CRIT' : ''}
                      </span>
                    </>
                  ) : entry.damage > 0 ? (
                    <>
                      <span className="blm__sep">&mdash;</span>
                      <span className="blm__hit">-{entry.damage} dmg</span>
                    </>
                  ) : entry.isDodged && !noTarget ? (
                    <>
                      <span className="blm__sep">&mdash;</span>
                      <span className="blm__block">Dodged</span>
                    </>
                  ) : entry.missed && !noTarget ? (
                    <>
                      <span className="blm__sep">&mdash;</span>
                      <span className="blm__block">Blocked</span>
                    </>
                  ) : skipApplied ? (
                    <>
                      <span className="blm__sep">&mdash;</span>
                      <span className="blm__applied">Applied</span>
                    </>
                  ) : null}
                  {entry.eliminated && <span className="blm__ko">KO</span>}
                </div>
              );
            }

            // Default: normal attack (dice vs dice). Server totals include effect modifiers (e.g. recovery dice) not shown on character sheet.
            const atkDiceUp = atk?.attackDiceUp ?? 0;
            const defDiceUp = def?.defendDiceUp ?? 0;
            const baseAtk = entry.attackRoll + atkDiceUp;
            const baseDef = entry.defendRoll + defDiceUp;
            const effAtk =
              entry.atkTotal != null && entry.atkTotal !== baseAtk ? entry.atkTotal - baseAtk : 0;
            const effDef =
              entry.defTotal != null && entry.defTotal !== baseDef ? entry.defTotal - baseDef : 0;
            return (
              <div className="blm__entry" key={i}>
                <span className="blm__round">R{entry.round}</span>
                <span className="blm__name" style={atkColor ? { color: atkColor } : undefined}>{atkName}</span>
                <span className="blm__dice">{entry.attackRoll}</span>
                {atkDiceUp > 0 && (
                  <span className="blm__bonus">+{atkDiceUp}</span>
                )}
                {effAtk !== 0 && (
                  <span className="blm__bonus">{effAtk > 0 ? `+${effAtk}` : `${effAtk}`}</span>
                )}
                {entry.atkTotal != null && effAtk !== 0 && (
                  <span className="blm__bonus">={entry.atkTotal}</span>
                )}
                <span className="blm__vs-sm">vs</span>
                <span className="blm__name" style={defColor ? { color: defColor } : undefined}>{defName}</span>
                <span className="blm__dice">{entry.defendRoll}</span>
                {defDiceUp > 0 && (
                  <span className="blm__bonus">+{defDiceUp}</span>
                )}
                {effDef !== 0 && (
                  <span className="blm__bonus">{effDef > 0 ? `+${effDef}` : `${effDef}`}</span>
                )}
                {entry.defTotal != null && effDef !== 0 && (
                  <span className="blm__bonus">={entry.defTotal}</span>
                )}
                <span className="blm__sep">&mdash;</span>
                {entry.isDodged ? (
                  <span className="blm__block">Dodged</span>
                ) : entry.missed ? (
                  <span className="blm__block">Blocked</span>
                ) : entry.damage > 0 ? (
                  <span className="blm__hit">-{entry.damage} dmg</span>
                ) : null}
                {entry.critRoll != null && entry.critRoll > 0 && (
                  <span className={entry.isCrit ? 'blm__crit' : 'blm__crit-miss'}>
                    D4:{entry.critRoll} {entry.isCrit ? 'CRIT' : 'NO'}
                  </span>
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
