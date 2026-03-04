import type { SVGProps } from 'react';

export default function Aphrodite(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 52C20 40 12 30 12 22a10 10 0 0120-2 10 10 0 0120 2c0 8-8 18-20 30z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 52C26 44 22 36 22 30a6 6 0 0110-1 6 6 0 0110 1c0 6-4 14-10 22z" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
