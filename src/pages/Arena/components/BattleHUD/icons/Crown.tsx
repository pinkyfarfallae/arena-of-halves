import type { SVGProps } from 'react';

/** Winged badge — victory icon (wings spread upward) */
export default function WinBadge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Left wing — sweeping upward */}
      <path d="M7.5 11.5L5 9L2 9.5L1.5 12.5L3 15L7.5 14.5Z" fill="currentColor" opacity="0.5" />
      {/* Right wing — sweeping upward */}
      <path d="M16.5 11.5L19 9L22 9.5L22.5 12.5L21 15L16.5 14.5Z" fill="currentColor" opacity="0.5" />
      {/* Medallion */}
      <circle cx="12" cy="13" r="5" strokeWidth="2" />
      <circle cx="12" cy="13" r="3.2" fill="currentColor" opacity="0.5" stroke="none" />
      {/* Diamond gem */}
      <path d="M12 9.5L14.8 13L12 16.5L9.2 13Z" fill="currentColor" opacity="0.3" strokeWidth="1.8" />
      {/* Crown point */}
      <path d="M10 8.5L12 5.5L14 8.5" strokeWidth="2" />
      <circle cx="12" cy="5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
