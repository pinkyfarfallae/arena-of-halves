import './StatOrb.scss';

export default function StatOrb({ value, label, max = 10, accent }: {
  value: number; label: string; max?: number; accent?: boolean;
}) {
  const pct = Math.min(value / max, 1);
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className={`so ${accent ? 'so--accent' : ''}`}>
      <div className="so__orb">
        <svg className="so__svg" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r={r} className="so__track" />
          <circle cx="30" cy="30" r={r} className="so__arc"
            strokeDasharray={circ} strokeDashoffset={offset} />
          <circle cx="30" cy="30" r={18} className="so__inner" />
        </svg>
        <span className="so__val">{value}</span>
      </div>
      <span className="so__label">{label}</span>
    </div>
  );
}
