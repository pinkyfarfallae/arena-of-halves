import type { ReactNode } from 'react';
import Lock from './icons/Lock';
import './TraitBox.scss';

export default function TraitBox({ label, raw, variant, icon }: {
  label: string; raw: string; variant: 'primary' | 'accent' | 'mixed'; icon?: ReactNode;
}) {
  const items = raw
    ? raw.split(/\s*\/\s*/).filter(Boolean).map(s => {
        const colonIdx = s.indexOf(':');
        return colonIdx > 0
          ? { title: s.substring(0, colonIdx).trim(), desc: s.substring(colonIdx + 1).trim() }
          : { title: s.trim(), desc: '' };
      })
    : [];

  return (
    <div className={`cs__trait cs__trait--${variant}`}>
      <h3 className="cs__trait-label"><span className="cs__trait-diamond">◆</span>{label}</h3>
      <div className="cs__trait-chips">
        {icon && <div className="cs__trait-watermark">{icon}</div>}
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
