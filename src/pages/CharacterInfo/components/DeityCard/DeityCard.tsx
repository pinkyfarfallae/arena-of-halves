import { DEITY_SVG, parseDeityNames } from '../../../../data/deities';
import './DeityCard.scss';

export default function DeityCard({ deity }: { deity: string }) {
  const names = parseDeityNames(deity);

  return (
    <div className="dcard">
      <div className={`dcard__icons ${names.length > 1 ? 'dcard__icons--dual' : ''}`}>
        {names.map(name => (
          <div key={name} className="dcard__deity">
            <div className="dcard__icon">
              {DEITY_SVG[name] || <span className="dcard__fallback">⚡</span>}
            </div>
            <span className="dcard__label">{name}</span>
          </div>
        ))}
      </div>
      <div className="dcard__line" />
      <span className="dcard__sub">Divine Parent</span>
    </div>
  );
}
