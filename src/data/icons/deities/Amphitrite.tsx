import type { SVGProps } from 'react';

export default function Amphitrite(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      {/* Crown */}
      <path d="M20 22l4-10 8 6 8-6 4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 22h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Dolphin arc */}
      <path d="M14 38c4-10 12-14 20-10s12 14 4 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M38 46c2-1 4-2 6-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="34" r="1.5" fill="currentColor" />
      {/* Waves */}
      <path d="M10 52c3-3 6-3 9 0s6 3 9 0 6-3 9 0 6 3 9 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 58c3-3 6-3 9 0s6 3 9 0 6-3 9 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
