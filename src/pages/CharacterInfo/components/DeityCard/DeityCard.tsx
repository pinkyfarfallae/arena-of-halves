import { DEITY_SVG, parseDeityNames, toDeityKey } from '../../../../data/deities';
import Lightning from '../../../../icons/Lightning';
import './DeityCard.scss';

export default function DeityCard({ deity }: { deity: string }) {
  const names = parseDeityNames(deity);

  return (
    <div className="dcard">
      <div className={`dcard__icons ${names.length > 1 ? 'dcard__icons--dual' : ''}`}>
        {names.map(name => {
          const iconKey = toDeityKey(name);
          return (
            <div key={name} className="dcard__deity">
              <div className="dcard__icon">
                {iconKey
                  ? DEITY_SVG[iconKey]
                  : (
                    <span className="dcard__fallback">
                      <Lightning width={12} height={12} />
                    </span>
                  )}
              </div>
              <span className="dcard__label">{name}</span>
            </div>
          );
        })}
      </div>
      <div className="dcard__line" />
      <span className="dcard__sub">Divine Parent</span>
    </div>
  );
}
