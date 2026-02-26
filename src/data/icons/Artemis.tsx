import type { SVGProps } from 'react';

export default function Artemis(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="32" cy="18" r="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 18a12 12 0 0124 0" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="18" r="4" stroke="currentColor" strokeWidth="1" />
      <path d="M32 30v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 40l8-6 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 54h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
