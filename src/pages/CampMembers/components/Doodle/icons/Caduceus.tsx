import type { SVGProps } from 'react';

export default function Caduceus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 6v22" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M10 10c4 2 8 2 12 0M10 16c4 2 8 2 12 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1" /></svg>
  );
}
