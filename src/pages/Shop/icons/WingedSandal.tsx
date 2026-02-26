import type { SVGProps } from 'react';

export default function WingedSandal(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 22c2-1 6-2 10-2s8 1 12 3" />
      <path d="M8 20c1-3 3-5 6-6s6 0 8 2" />
      <path d="M5 24l1-4M9 24l0.5-3" />
      <path d="M22 16c1-3 0-6-1-8" opacity="0.5" />
      <path d="M24 15c2-2 3-5 2-7" opacity="0.5" />
      <path d="M20 17c0-3-1-6-3-8" opacity="0.5" />
    </svg>
  );
}
