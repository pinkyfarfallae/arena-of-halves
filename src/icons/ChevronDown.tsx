import type { SVGProps } from 'react';

export default function ChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1 1.5L6 6.5L11 1.5" />
    </svg>
  );
}
