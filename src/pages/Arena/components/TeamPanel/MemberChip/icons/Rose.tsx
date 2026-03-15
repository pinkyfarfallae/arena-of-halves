import { darken } from "../../../../../../utils/color";

interface Props {
  className?: string;
  width?: number | string;
  height?: number | string;
  /** Petal color; default pink */
  color?: string;
  /** Center / inner petals; default darker pink */
  centerColor?: string;
}

const DEFAULT_PINK = '#e91e8c';
const DEFAULT_CENTER = '#c2185b';

/**
 * Rose icon: top-down rose with overlapping spiral petals (wide rounded tips, narrow at center).
 * viewBox 0 0 32 32, center at (16,16).
 */
export default function Rose({
  className,
  width = 16,
  height = 16,
  color = DEFAULT_PINK,
  centerColor = DEFAULT_CENTER,
}: Props) {
  // One petal: wide rounded outer tip, tapers toward center (16,16). Drawn with tip pointing up.
  const outerPetal =
    'M16 15.5 C10 15.5 5 12 5 6.5 C5 3.5 10 2 16 3.5 C22 2 27 3.5 27 6.5 C27 12 22 15.5 16 15.5 Z';
  const midPetal =
    'M16 14.5 C11 14.5 8 11.5 8 8 C8 6 11.5 5 16 6 C20.5 5 24 6 24 8 C24 11.5 21 14.5 16 14.5 Z';
  const innerPetal =
    'M16 14 C12.5 14 10.5 12 10.5 10 C10.5 8.5 12 8 16 8.8 C20 8 21.5 8.5 21.5 10 C21.5 12 19.5 14 16 14 Z';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={width}
      height={height}
      className={className}
      aria-hidden
    >
      <>
        {/* Outer: 5 petals, wide rounded tips, spiral (0, 72, 144, 216, 288) */}
        <path d={outerPetal} fill={color} opacity="0.98" />
        <path d={outerPetal} fill={color} opacity="0.96" transform="rotate(72 16 16)" />
        <path d={outerPetal} fill={color} opacity="0.94" transform="rotate(144 16 16)" />
        <path d={outerPetal} fill={color} opacity="0.92" transform="rotate(216 16 16)" />
        <path d={outerPetal} fill={color} opacity="0.94" transform="rotate(288 16 16)" />
        {/* Middle: 5 petals offset 36deg for spiral overlap */}
        <path d={midPetal} fill={color} opacity="0.9" transform="rotate(36 16 16)" />
        <path d={midPetal} fill={color} opacity="0.88" transform="rotate(108 16 16)" />
        <path d={midPetal} fill={color} opacity="0.86" transform="rotate(180 16 16)" />
        <path d={midPetal} fill={color} opacity="0.88" transform="rotate(252 16 16)" />
        <path d={midPetal} fill={color} opacity="0.9" transform="rotate(324 16 16)" />
        {/* Inner: 5 small petals, spiral */}
        <path d={innerPetal} fill={centerColor} opacity="0.92" transform="rotate(72 16 16)" />
        <path d={innerPetal} fill={centerColor} opacity="0.9" transform="rotate(144 16 16)" />
        <path d={innerPetal} fill={centerColor} opacity="0.88" transform="rotate(216 16 16)" />
        <path d={innerPetal} fill={centerColor} opacity="0.9" transform="rotate(288 16 16)" />
        <path d={innerPetal} fill={centerColor} opacity="0.92" transform="rotate(360 16 16)" />
        {/* Tight bud center */}
        <circle cx="16" cy="16" r="2.8" fill={darken(centerColor, 0.35)} opacity="1" />
      </>
    </svg>
  );
}
