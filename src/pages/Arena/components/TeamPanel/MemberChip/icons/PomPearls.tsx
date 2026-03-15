import { useId } from 'react';

/** Pearl colors: caster = red, spirit = black, both = red-black alternating. */
export interface PomPearlsProps {
  /** Optional class for the SVG root. */
  className?: string;
  /** Fill for each pearl (default dark red). */
  pearlColor?: string;
  /** When set, alternate pearlColor and alternateColor (red-black for caster+spirit). */
  alternateColor?: string;
  /** Highlight color for pearl shine (default lighter red/white). */
  highlightColor?: string;
}

const DEFAULT_PEARL = '#8b0000';
const DEFAULT_HIGHLIGHT = '#c62828';
const SPIRIT_HIGHLIGHT = '#444';

/**
 * Pearls around the frame: Pomegranate caster (red), Spirit (black), or both (red-black alternating).
 * Designed for viewBox 0 0 100 100, to be scaled over the chip frame.
 */
export default function PomPearls({
  className,
  pearlColor = DEFAULT_PEARL,
  alternateColor,
  highlightColor = DEFAULT_HIGHLIGHT,
}: PomPearlsProps = {}) {
  const baseId = useId().replace(/:/g, '-');
  const gradientIdA = `${baseId}-a`;
  const gradientIdB = `${baseId}-b`;
  const r = 1.6;
  const inset = 10;
  const size = 100 - 2 * inset; // 80
  const diameter = 2 * r;
  const n = Math.round(size / diameter);
  const step = size / n;
  const pearls: [number, number][] = [];
  for (let i = 0; i <= n; i++) pearls.push([inset + i * step, inset]);
  for (let i = 1; i <= n; i++) pearls.push([100 - inset, inset + i * step]);
  for (let i = 1; i <= n; i++) pearls.push([100 - inset - i * step, 100 - inset]);
  for (let i = 1; i < n; i++) pearls.push([inset, 100 - inset - i * step]);

  const colorB = alternateColor ?? pearlColor;
  const highlightB = alternateColor ? SPIRIT_HIGHLIGHT : highlightColor;

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <radialGradient id={gradientIdA} cx="32%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="45%" stopColor={highlightColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor={pearlColor} />
        </radialGradient>
        <radialGradient id={gradientIdB} cx="32%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#666" stopOpacity="0.7" />
          <stop offset="45%" stopColor={highlightB} stopOpacity="0.95" />
          <stop offset="100%" stopColor={colorB} />
        </radialGradient>
      </defs>
      {pearls.map(([cx, cy], i) => (
        <circle
          key={i}
          className="mchip__pom-pearl"
          cx={cx}
          cy={cy}
          r={r}
          fill={alternateColor ? `url(#${i % 2 === 0 ? gradientIdA : gradientIdB})` : `url(#${gradientIdA})`}
        />
      ))}
    </svg>
  );
}
