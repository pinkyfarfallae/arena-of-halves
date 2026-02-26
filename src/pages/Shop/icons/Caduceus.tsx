import type { SVGProps } from 'react';

export default function Caduceus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M8 5c-3 0-5 1.5-5 3.5S5 12 8 12c3 0 4-1.5 4-3.5" />
      <path d="M16 5c3 0 5 1.5 5 3.5S19 12 16 12c-3 0-4-1.5-4-3.5" />
      <path d="M9 12c-2.5 0-4 1.2-4 3s1.5 3 4 3c2.5 0 3-1.2 3-3" />
      <path d="M15 12c2.5 0 4 1.2 4 3s-1.5 3-4 3c-2.5 0-3-1.2-3-3" />
      <circle cx="9" cy="2.5" r="1.5" fill="currentColor" strokeWidth="0" />
      <circle cx="15" cy="2.5" r="1.5" fill="currentColor" strokeWidth="0" />
    </svg>
  );
}
