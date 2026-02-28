import type { FighterState } from '../../../../types/battle';
import { POWER_META } from '../../../CharacterInfo/constants/powerMeta';
import './FighterCard.scss';

export default function FighterCard({ fighter, side }: { fighter: FighterState; side: 'left' | 'right' }) {
  const hpPct = Math.min((fighter.currentHp / fighter.maxHp) * 100, 100);

  const powers = fighter.powers || [];
  const orderedPowers = ['Passive', '1st Skill', '2nd Skill', 'Ultimate']
    .map(s => powers.find(p => p.status === s))
    .filter(Boolean);

  return (
    <div className={`fcard fcard--${side}`}>
      {/* Avatar + Name */}
      <div className="fcard__header">
        {fighter.image ? (
          <img className="fcard__avatar" src={fighter.image} alt={fighter.nicknameEng} />
        ) : (
          <div className="fcard__avatar fcard__avatar--placeholder">
            {fighter.nicknameEng.charAt(0)}
          </div>
        )}
        <div className="fcard__name-group">
          <h3 className="fcard__name">{fighter.nicknameEng}</h3>
          <span className="fcard__deity">{fighter.deityBlood}</span>
        </div>
      </div>

      {/* HP Bar */}
      <div className="fcard__hp">
        <div className="fcard__hp-track">
          <div className="fcard__hp-fill" style={{ width: `${hpPct}%` }} />
        </div>
        <span className="fcard__hp-label">HP {fighter.currentHp}/{fighter.maxHp}</span>
      </div>

      {/* Combat Stats */}
      <div className="fcard__stats">
        <div className="fcard__stat">
          <span className="fcard__stat-val">{fighter.damage}</span>
          <span className="fcard__stat-label">DMG</span>
        </div>
        <div className="fcard__stat">
          <span className="fcard__stat-val">+{fighter.attackDiceUp}</span>
          <span className="fcard__stat-label">ATK Dice</span>
        </div>
        <div className="fcard__stat">
          <span className="fcard__stat-val">+{fighter.defendDiceUp}</span>
          <span className="fcard__stat-label">DEF Dice</span>
        </div>
        <div className="fcard__stat">
          <span className="fcard__stat-val">{fighter.speed}</span>
          <span className="fcard__stat-label">SPD</span>
        </div>
        <div className="fcard__stat">
          <span className="fcard__stat-val">{fighter.rerollsLeft}</span>
          <span className="fcard__stat-label">Reroll</span>
        </div>
      </div>

      {/* Skill Points */}
      <div className="fcard__skill-points">
        {[
          ['PASSIVE', fighter.passiveSkillPoint],
          ['SKILL', fighter.skillPoint],
          ['ULTIMATE', fighter.ultimateSkillPoint],
        ].map(([label, val]) => (
          <div className="fcard__sp" key={label}>
            <span className="fcard__sp-label">{label}</span>
            <span className="fcard__sp-val">{val}</span>
          </div>
        ))}
      </div>

      {/* Powers */}
      <div className="fcard__powers">
        {orderedPowers.map((p) => {
          if (!p) return null;
          const meta = POWER_META[p.status] || { icon: '◇', tag: p.status.toUpperCase(), cls: '' };
          return (
            <div className={`fcard__power ${meta.cls}`} key={p.status}>
              <span className="fcard__power-icon">{meta.icon}</span>
              <div className="fcard__power-info">
                <span className="fcard__power-tag">{meta.tag}</span>
                <span className="fcard__power-name">{p.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
