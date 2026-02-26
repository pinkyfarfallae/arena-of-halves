import type { SVGProps } from 'react';

export default function Arrow(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M6 26C10 22 14 14 26 8M26 8l-6 1M26 8l-1 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}
