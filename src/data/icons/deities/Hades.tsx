import type { SVGProps } from 'react';

export default function Hades(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 14v42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 14v-4a2 2 0 014 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 14v-4a2 2 0 00-4 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 20h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 56h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
