import type { SVGProps } from 'react';

export default function Bow(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M8 6c0 12 4 20 8 20s8-8 8-20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M8 6h16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
