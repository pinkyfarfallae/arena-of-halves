interface Props {
  gradientId: string;
  color1: string;
  color2: string;
}

export default function ReaperScythe({ gradientId, color1, color2 }: Props) {
  return (
    <svg viewBox="0 0 24 24">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      {/* Scythe blade — curved crefragrance */}
      <path
        d="M6 3C6 3 4 7 4 10c0 4 4 7 8 7 2.5 0 4.5-1 6-3-1 2-4 4-7 4C6 18 2 14 2 10c0-3.5 2.5-6 4-7z"
        fill={`url(#${gradientId})`}
      />
      {/* Handle — long diagonal staff */}
      <rect
        x="11" y="8" width="2" height="14" rx="1"
        transform="rotate(-15 12 15)"
        fill={`url(#${gradientId})`}
        opacity="0.85"
      />
    </svg>
  );
}
