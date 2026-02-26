import type { SVGProps } from 'react';

export default function Refresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 8a6 6 0 0111.5-2.4M14 8A6 6 0 012.5 10.4" />
      <polyline points="2 3 2 8 7 8" />
      <polyline points="14 13 14 8 9 8" />
    </svg>
  );
}
