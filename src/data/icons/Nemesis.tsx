import type { SVGProps } from 'react';

export default function Nemesis(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 8l-6 18h12L32 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 26v22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 48h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="38" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="42" cy="38" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 34v8M42 34v8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M18 54h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
