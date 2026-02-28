import type { FighterState } from '../../../../../types/battle';
import { POWER_META } from '../../../../CharacterInfo/constants/powerMeta';
import { DEITY_DISPLAY_OVERRIDES } from '../../../../CharacterInfo/constants/overrides';
import LockOpen from '../../../../CharacterInfo/icons/LockOpen';
import LockClosed from '../../../../CharacterInfo/icons/LockClosed';
import { DEITY_SVG } from '../../../../../data/deities';
import './MemberChip.scss';

const PATTERN_ROWS = 23;
const ICONS_PER_ROW = 30;

interface Props {
  fighter: FighterState;
  isAttacker?: boolean;
  isDefender?: boolean;
  isEliminated?: boolean;
  isTargetable?: boolean;
  onSelect?: () => void;
}

export default function MemberChip({ fighter, isAttacker, isDefender, isEliminated, isTargetable, onSelect }: Props) {
  const hpPct = Math.min((fighter.currentHp / fighter.maxHp) * 100, 100);
  const deityLabel = DEITY_DISPLAY_OVERRIDES[fighter.characterId] || fighter.deityBlood;
  const deityIcon = DEITY_SVG[deityLabel.toLowerCase()];

  const powers = fighter.powers || [];
  const orderedPowers = ['Passive', '1st Skill', '2nd Skill', 'Ultimate']
    .map((s) => powers.find((p) => p.status === s))
    .filter(Boolean);

  const chipClass = [
    'mchip',
    isAttacker && 'mchip--attacker',
    isDefender && 'mchip--defender',
    isEliminated && 'mchip--eliminated',
    isTargetable && 'mchip--targetable',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={chipClass}
      style={{ '--chip-primary': fighter.theme[0], '--chip-accent': fighter.theme[1] } as React.CSSProperties}
      onClick={isTargetable && onSelect ? onSelect : undefined}
      role={isTargetable ? 'button' : undefined}
    >
      {/* Body — clips pattern, fades edges with gradient */}
      <div className="mchip__body">
        {deityIcon && (
          <div className="mchip__pattern" aria-hidden="true">
            {Array.from({ length: PATTERN_ROWS }, (_, row) => (
              <div className="mchip__pattern-row" key={row}>
                {Array.from({ length: ICONS_PER_ROW }, (_, col) => (
                  <span className="mchip__pattern-icon" key={col}>{deityIcon}</span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card frame — outside body so it's not masked */}
      <div className="mchip__frame">
        {fighter.image ? (
          <img className="mchip__bg" src={fighter.image} alt="" />
        ) : (
          <div className="mchip__bg mchip__bg--placeholder">
            {fighter.nicknameEng.charAt(0)}
          </div>
        )}

        <div className="mchip__inner-border" />

        <div className="mchip__overlay">
          <span className="mchip__name">{fighter.nicknameEng}</span>
          <span className="mchip__deity-tag">{deityLabel}</span>
          <div className="mchip__hp">
            <div className="mchip__hp-track">
              <div className="mchip__hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
            <span className="mchip__hp-label">
              {fighter.currentHp}/{fighter.maxHp}
            </span>
          </div>
        </div>
      </div>

      {/* Hover stat popup — outside body so it's not clipped */}
      <div className="mchip__popup">
        <div className="mchip__popup-header">
          <span className="mchip__popup-name">{fighter.nicknameEng}</span>
          <span className="mchip__popup-deity">{deityLabel}</span>
        </div>

        {/* Combat stats */}
        <div className="mchip__stats">
          {[
            ['DMG', fighter.damage],
            ['+ATK', fighter.attackDiceUp],
            ['+DEF', fighter.defendDiceUp],
            ['SPD', fighter.speed],
            ['Reroll', fighter.rerollsLeft],
          ].map(([label, val]) => (
            <div className="mchip__stat" key={label as string}>
              <span className="mchip__stat-lbl">{label}</span>
              <span className="mchip__stat-val">{val}</span>
            </div>
          ))}
        </div>

        {/* Skill points */}
        <div className="mchip__skills">
          {([
            ['PASSIVE', fighter.passiveSkillPoint],
            ['SKILL', fighter.skillPoint],
            ['ULTIMATE', fighter.ultimateSkillPoint],
          ] as [string, string][]).map(([label, val]) => {
            const unlocked = val.toLowerCase() === 'unlock';
            return (
              <div key={label} className={`mchip__so ${unlocked ? '' : 'mchip__so--locked'}`}>
                <div className="mchip__so-orb">
                  <svg className="mchip__so-svg" viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r={26} className="mchip__so-track" />
                    <circle cx="30" cy="30" r={26} className="mchip__so-arc"
                      strokeDasharray={2 * Math.PI * 26}
                      strokeDashoffset={unlocked ? 0 : 2 * Math.PI * 26} />
                  </svg>
                  {unlocked ? <LockOpen className="mchip__so-icon" /> : <LockClosed className="mchip__so-icon" />}
                </div>
                <span className="mchip__so-label">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Powers */}
        <div className="mchip__powers">
          {orderedPowers.map((p) => {
            if (!p) return null;
            const meta = POWER_META[p.status] || { icon: '◇', tag: p.status.toUpperCase(), cls: '' };
            return (
              <div className="mchip__power" key={p.status}>
                <span className="mchip__power-icon">{meta.icon}</span>
                <div className="mchip__power-info">
                  <span className="mchip__power-tag">{meta.tag}</span>
                  <span className="mchip__power-name">{p.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
