import { Power } from '../../../../data/characters';
import { POWER_META } from '../../constants/powerMeta';
import './PowerCard.scss';

export default function PowerCard({ power, index }: { power: Power; index: number }) {
  const meta = POWER_META[power.status] || { icon: '◇', tag: power.status.toUpperCase(), cls: '' };

  return (
    <div className={`pcard ${meta.cls}`} style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="pcard__accent" />
      <div className="pcard__orb">
        <span className="pcard__orb-icon">{meta.icon}</span>
      </div>
      <div className="pcard__body">
        <span className="pcard__tag">{meta.tag}</span>
        <h4 className="pcard__name">{power.name}</h4>
        <p className="pcard__desc">{power.description}</p>
      </div>
    </div>
  );
}
