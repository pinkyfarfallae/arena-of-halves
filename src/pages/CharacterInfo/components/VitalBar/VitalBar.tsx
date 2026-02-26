import './VitalBar.scss';

export default function VitalBar({ value, max, label, accent }: {
  value: number; max: number; label: string; accent?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="vbar">
      <span className="vbar__label">{label}</span>
      <div className="vbar__track">
        <div className={`vbar__fill ${accent ? 'vbar__fill--accent' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="vbar__num">{value}</span>
    </div>
  );
}
