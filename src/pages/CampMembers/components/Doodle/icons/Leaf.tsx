import type { SVGProps } from 'react';

export default function Leaf(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 28C8 24 4 16 8 8c6 2 12 8 12 16" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 16c4 2 6 6 8 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
