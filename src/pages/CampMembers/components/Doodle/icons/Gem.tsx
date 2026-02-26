import type { SVGProps } from 'react';

export default function Gem(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M10 12h12l-6 16z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 12l3-6h6l3 6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M13 6l3 6 3-6" stroke="currentColor" strokeWidth="1" /></svg>
  );
}
