import type { SVGProps } from 'react';

export default function Ares(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 10L18 28h8v26h12V28h8L32 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 54h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="20" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 34h16M26 40h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
