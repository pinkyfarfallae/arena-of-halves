interface Props {
  gradientId: string;
  color1: string;
  color2: string;
}

const cx = 12;
const cy = 12;

/** One large flame ray (pointing up): narrow curved sides, tapered at tip */
const LARGE_RAY = 'M 11.05 6.58 C 10 4 11 2 12 1 C 13 2 14 4 12.95 6.58 Z';

/** One small pointed ray between large rays (pointing up) */
const SMALL_RAY = 'M 11.6 6.5 L 12 2.8 L 12.4 6.5 Z';

const LARGE_RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const SMALL_RAY_ANGLES = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];

export default function Sun({ gradientId, color1, color2 }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      {/* 8 large curved flame rays */}
      <g fill={`url(#${gradientId})`}>
        {LARGE_RAY_ANGLES.map((angle) => (
          <path
            key={`l-${angle}`}
            d={LARGE_RAY}
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        ))}
      </g>
      {/* 8 small pointed rays between */}
      <g fill={`url(#${gradientId})`}>
        {SMALL_RAY_ANGLES.map((angle) => (
          <path
            key={`s-${angle}`}
            d={SMALL_RAY}
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        ))}
      </g>
      {/* Central circle on top — creates the gap between core and rays */}
      <circle cx={cx} cy={cy} r="4" fill={`url(#${gradientId})`} />
    </svg>
  );
}
