import type { SVGProps } from 'react';

/** Winged badge — defeat icon (wings drooping downward) */
export default function LoseBadge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* Left wing — drooping down */}
      <path d="M7.5 12L5 11L2 12L1.5 14.5L3 16.5L7.5 15Z" fill="currentColor" opacity="0.35" />
      {/* Right wing — drooping down */}
      <path d="M16.5 12L19 11L22 12L22.5 14.5L21 16.5L16.5 15Z" fill="currentColor" opacity="0.35" />
      {/* Medallion */}
      <circle cx="12" cy="13" r="5" strokeWidth="2" />
      <circle cx="12" cy="13" r="3.2" fill="currentColor" opacity="0.5" stroke="none" />
      {/* Diamond gem */}
      <path d="M12 9.5L14.8 13L12 16.5L9.2 13Z" fill="currentColor" opacity="0.35" strokeWidth="1.8" />
      {/* Small top point */}
      <path d="M11 8.5L12 6.5L13 8.5" strokeWidth="2" />
    </svg>
  );
}
