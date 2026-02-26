import { Power } from '../../../../data/characters';
import { POWER_META } from '../../constants/powerMeta';
import './PowerCard.scss';

function FormatLine({ text, bullet }: { text: string; bullet?: boolean }) {
  const colonIdx = text.indexOf(':');
  const content = colonIdx > 0 ? (
    <>
      <strong className="pcard__desc-label">{text.substring(0, colonIdx).trim()}</strong>
      <span>{text.substring(colonIdx + 1).trim()}</span>
    </>
  ) : (
    <span>{text.trim()}</span>
  );
  return <span className={bullet ? 'pcard__line pcard__bullet' : 'pcard__line'}>{content}</span>;
}

function FormatDesc({ text }: { text: string }) {
  // Split into lines on / or newline, then check each for * bullet prefix
  const lines = text.split(/\s*\/\s*|\n/).filter(Boolean);
  return (
    <>
      {lines.map((line, i) => {
        const starMatch = line.match(/^\s*\*\s*(.*)/);
        return starMatch
          ? <FormatLine key={i} text={starMatch[1]} bullet />
          : <FormatLine key={i} text={line} />;
      })}
    </>
  );
}

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
        <div className="pcard__desc">
          <FormatDesc text={power.description} />
        </div>
      </div>
    </div>
  );
}
