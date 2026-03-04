import type { SVGProps } from 'react';

export default function Hermes(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 8v48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="14" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 24c8-2 12 4 14 0s6-2 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 30c8-2 12 4 14 0s6-2 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 38l-8 8M40 38l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 44l4 4M46 48l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
