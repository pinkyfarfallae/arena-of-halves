import type { SVGProps } from 'react';

export default function Hera(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="32" cy="16" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 16h16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M28 12h8M28 20h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M32 24v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 30h24v4H20z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22 34v18M42 34v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 34v18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M18 52h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
