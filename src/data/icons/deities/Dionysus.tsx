import type { SVGProps } from 'react';

export default function Dionysus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="26" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="38" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="28" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="28" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="42" cy="28" r="4" stroke="currentColor" strokeWidth="1" />
      <path d="M32 34v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 52c0-4 4-6 8-4s8 0 8 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
