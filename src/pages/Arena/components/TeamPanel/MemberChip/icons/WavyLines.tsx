import { useId } from 'react';

// 10 full waves in 200 units (wavelength 20)
const WAVE_D = 'M0 20 Q5 2 10 20 Q15 38 20 20 Q25 2 30 20 Q35 38 40 20 Q45 2 50 20 Q55 38 60 20 Q65 2 70 20 Q75 38 80 20 Q85 2 90 20 Q95 38 100 20 Q105 2 110 20 Q115 38 120 20 Q125 2 130 20 Q135 38 140 20 Q145 2 150 20 Q155 38 160 20 Q165 2 170 20 Q175 38 180 20 Q185 2 190 20 Q195 38 200 20';
const LINE_COUNT = 10;
const SPACING = 40;

// Static vertical linear gradient: yellow (top) → pink → white (bottom)
const GRADIENT_STOPS = [
  { offset: 0, color: 'rgb(255, 251, 0)' },   // yellow
  { offset: 0.05, color: 'rgb(255, 250, 252)' }, // pink
  { offset: 0.1, color: 'rgb(255, 255, 255)' },     // white
];

interface Props {
  className?: string;
}

export default function WavyLines({ className }: Props) {
  const id = useId();
  const safeId = id.replace(/:/g, '');
  const gradientId = `wavy-line-grad-${safeId}`;
  const glowFilterId = `wavy-line-glow-${safeId}`;
  const height = (LINE_COUNT - 1) * SPACING + 28;
  return (
    <svg
      className={className}
      viewBox={`0 0 200 ${height}`}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="100"
          y1="0"
          x2="100"
          y2={height}
          gradientUnits="userSpaceOnUse"
          colorInterpolation="sRGB"
        >
          {GRADIENT_STOPS.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <filter id={glowFilterId} x="-15%" y="-15%" width="130%" height="130%" filterUnits="objectBoundingBox">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${glowFilterId})`}>
        {Array.from({ length: LINE_COUNT }, (_, i) => (
          <g key={i} transform={`translate(0, ${i * SPACING})`}>
            <path
              className="mchip__wavy-line-path"
              d={WAVE_D}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="1.5"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
