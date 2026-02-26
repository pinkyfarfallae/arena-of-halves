import type { SVGProps } from 'react';

export default function Hypnos(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M40 12a16 16 0 10-4 30 14 14 0 01-4-30z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="28" cy="30" r="2" fill="currentColor" />
      <circle cx="36" cy="28" r="1.5" fill="currentColor" />
      <circle cx="22" cy="26" r="1" fill="currentColor" />
      <path d="M18 48h28M22 52h20M26 56h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
