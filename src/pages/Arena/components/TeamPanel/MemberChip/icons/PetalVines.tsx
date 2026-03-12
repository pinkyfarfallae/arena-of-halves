import { useId } from 'react';

/** Optional: override stem gradient (default: green → pink → light green). */
export interface PetalVinesProps {
  /** Gradient start (top). Default `#92e997`. */
  gradientStart?: string;
  /** Gradient middle. Default `#ffc0e0`. */
  gradientMid?: string;
  /** Gradient end (bottom). Default `#e6ffe7`. */
  gradientEnd?: string;
}

const DEFAULT_GRADIENT = {
  gradientStart: '#92e997',
  gradientMid: '#ffc0e0',
  gradientEnd: '#92e997',
} as const;

/**
 * Vine frame — curved stems and leaves along all four edges (Petal Shield / Secret of Dryad).
 * Designed for viewBox 0 0 100 100, to be scaled over the chip frame.
 */
export default function PetalVines({
  gradientStart = DEFAULT_GRADIENT.gradientStart,
  gradientMid = DEFAULT_GRADIENT.gradientMid,
  gradientEnd = DEFAULT_GRADIENT.gradientEnd,
}: PetalVinesProps = {}) {
  const gradientId = useId().replace(/:/g, '-');
  return (
    <svg
      className="mchip__petal-vines-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor={gradientStart} />
          <stop offset="50%" stopColor={gradientMid} />
          <stop offset="100%" stopColor={gradientEnd} />
        </linearGradient>
      </defs>

      {/* Top edge: winding stem + leaves */}
      <path
        className="mchip__petal-vine-stem mchip__petal-vine-stem--top"
        d="M 2 7 Q 15 10 28 5 T 52 9 T 72 5 T 88 8 T 98 6"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse className="mchip__petal-vine-leaf" cx="25" cy="5" rx="3" ry="2.2" transform="rotate(-25 25 5)" />
      <ellipse className="mchip__petal-vine-leaf" cx="55" cy="7" rx="2.8" ry="2" transform="rotate(15 55 7)" />
      <ellipse className="mchip__petal-vine-leaf" cx="88" cy="5" rx="2.5" ry="1.8" transform="rotate(-15 88 5)" />

      {/* Right edge: stem + leaves */}
      <path
        className="mchip__petal-vine-stem mchip__petal-vine-stem--right"
        d="M 95 2 Q 97 15 94 30 T 96 55 T 94 75 T 97 90 T 95 98"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse className="mchip__petal-vine-leaf" cx="96" cy="28" rx="2.2" ry="3" transform="rotate(65 96 28)" />
      <ellipse className="mchip__petal-vine-leaf" cx="95" cy="55" rx="2" ry="2.8" transform="rotate(-70 95 55)" />
      <ellipse className="mchip__petal-vine-leaf" cx="96" cy="88" rx="2.2" ry="2.5" transform="rotate(68 96 88)" />

      {/* Bottom edge: stem + leaves */}
      <path
        className="mchip__petal-vine-stem mchip__petal-vine-stem--bottom"
        d="M 98 92 Q 82 95 65 91 T 38 95 T 15 91 T 2 92"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse className="mchip__petal-vine-leaf" cx="78" cy="94" rx="3" ry="2.2" transform="rotate(155 78 94)" />
      <ellipse className="mchip__petal-vine-leaf" cx="48" cy="93" rx="2.8" ry="2" transform="rotate(195 48 93)" />
      <ellipse className="mchip__petal-vine-leaf" cx="18" cy="94" rx="2.5" ry="1.8" transform="rotate(165 18 94)" />

      {/* Left edge: stem + leaves */}
      <path
        className="mchip__petal-vine-stem mchip__petal-vine-stem--left"
        d="M 6 98 Q 4 82 7 62 T 4 38 T 7 18 T 6 2"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse className="mchip__petal-vine-leaf" cx="4" cy="72" rx="2.2" ry="3" transform="rotate(-115 4 72)" />
      <ellipse className="mchip__petal-vine-leaf" cx="5" cy="45" rx="2" ry="2.8" transform="rotate(110 5 45)" />
      <ellipse className="mchip__petal-vine-leaf" cx="4" cy="18" rx="2.2" ry="2.5" transform="rotate(-112 4 18)" />
    </svg>
  );
}
