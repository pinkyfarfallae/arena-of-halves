import type { SVGProps } from 'react';

export default function Poseidon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 8v48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 8c0 6 8 6 8 0s8-6 8 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 16h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 22l12-4 12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
