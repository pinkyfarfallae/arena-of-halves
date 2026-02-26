import type { SVGProps } from 'react';

export default function Swirl(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M8 24C6 16 10 8 18 8s10 6 6 12c-3 4-8 2-6-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  );
}
