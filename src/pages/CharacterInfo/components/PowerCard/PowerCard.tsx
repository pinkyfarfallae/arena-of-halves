import { Power } from '../../../../data/characters';
import { POWER_META } from '../../constants/powerMeta';
import './PowerCard.scss';

function FormatLine({ text, bullet }: { text: string; bullet?: boolean }) {
  const colonIdx = text.indexOf(':');
  // Helper to bold all text inside double quotes
  const boldQuoted = (str: string) => {
    const parts = [];
    let lastIdx = 0;
    const regex = /"([^"]+)"/g;
    let match;
    let key = 0;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        parts.push(str.slice(lastIdx, match.index));
      }
      parts.push(<b key={key++}>{match[1]}</b>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < str.length) {
      parts.push(str.slice(lastIdx));
    }
    return parts;
  };
  const content = colonIdx > 0 ? (
    <>
      <strong className="pcard__desc-label">{text.substring(0, colonIdx).trim()}</strong>
      <span>{boldQuoted(text.substring(colonIdx + 1).trim())}</span>
    </>
  ) : (
    <span>{boldQuoted(text.trim())}</span>
  );
  return <span className={bullet ? 'pcard__line pcard__bullet' : 'pcard__line'}>{content}</span>;
}

function FormatDesc({ text }: { text: string }) {
  // Split into lines on / or newline, then check each for * bullet prefix
  const lines = text.split(/\s*\\n\s*|\s*\/\s*|\n/).filter(Boolean);
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
  const meta = POWER_META[power.type] || { icon: '◇', tag: power.type.toUpperCase(), cls: '' };

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
