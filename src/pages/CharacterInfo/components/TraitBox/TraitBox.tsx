import Lock from './icons/Lock';
import './TraitBox.scss';

export default function TraitBox({ label, raw, variant }: {
  label: string; raw: string; variant: 'primary' | 'accent' | 'mixed';
}) {
  const items = raw
    ? raw.split(',').map(s => s.trim()).filter(Boolean).map(s => {
        const [title, ...rest] = s.split(':');
        return { title: title.trim(), desc: rest.join(':').trim() || '' };
      })
    : [];

  return (
    <div className={`cs__trait cs__trait--${variant}`}>
      <h3 className="cs__trait-label"><span className="cs__trait-diamond">◆</span>{label}</h3>
      <div className="cs__trait-chips">
        {items.length > 0 ? items.map((item, i) => (
          <span key={i} className="cs__chip">
            <span className="cs__chip-title">{item.title}</span>
            {item.desc && <span className="cs__chip-desc">{item.desc}</span>}
          </span>
        )) : (
          <div className="cs__trait-empty">
            <Lock className="cs__trait-empty-icon" />
            <span className="cs__trait-empty-text">Undiscovered</span>
          </div>
        )}
      </div>
    </div>
  );
}
