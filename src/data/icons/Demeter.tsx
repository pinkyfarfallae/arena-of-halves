import type { SVGProps } from 'react';

export default function Demeter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 56V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 28c-6-8-16-8-16 2 0 8 16 4 16-2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 22c6-10 18-8 16 4-2 8-16 2-16-4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 16c-4-10-2-16 4-12s4 12 0 12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M28 56h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
