import type { SVGProps } from 'react';

export default function Reset(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3 12a9 9 0 1 1 2.64 6.36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 7v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
