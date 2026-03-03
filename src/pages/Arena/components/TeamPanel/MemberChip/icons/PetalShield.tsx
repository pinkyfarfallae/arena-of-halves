interface Props {
  gradientId: string;
  color1: string;
  color2: string;
}

export default function PetalShield({ gradientId, color1, color2 }: Props) {
  return (
    <svg viewBox="0 0 24 24">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
      </defs>
      <path
        d="M12 2L3 7v5c0 5.25 3.83 10.16 9 11.33C17.17 22.16 21 17.25 21 12V7l-9-5z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
