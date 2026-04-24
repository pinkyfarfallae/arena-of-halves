import type { SVGProps } from 'react';

export default function IrisFountain(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="st__icon" {...props}>
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M24 10v28M16 14l16 20M32 14L16 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
