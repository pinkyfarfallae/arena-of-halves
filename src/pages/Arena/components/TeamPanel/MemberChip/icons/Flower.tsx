interface Props {
  className?: string;
  width?: number | string;
  height?: number | string;
  /** For falling animation; default white */
  color?: string;
}

export default function Flower({ className, width = 16, height = 16, color = 'rgba(255,255,255,0.92)' }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={width}
      height={height}
      className={className}
      fill={color}
      aria-hidden
    >
      {/* 5 rounded petals (ellipses rotated around center) */}
      <ellipse cx="16" cy="7" rx="3.5" ry="6" />
      <ellipse cx="16" cy="7" rx="3.5" ry="6" transform="rotate(72 16 16)" />
      <ellipse cx="16" cy="7" rx="3.5" ry="6" transform="rotate(144 16 16)" />
      <ellipse cx="16" cy="7" rx="3.5" ry="6" transform="rotate(216 16 16)" />
      <ellipse cx="16" cy="7" rx="3.5" ry="6" transform="rotate(288 16 16)" />
      {/* Center */}
      <circle cx="16" cy="16" r="4" fill={'#f9bf77'} opacity="0.95" />
    </svg>
  );
}
