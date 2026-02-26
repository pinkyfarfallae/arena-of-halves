import type { SVGProps } from 'react';

export default function Gear(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1.3" /><path d="M16 4v4M16 24v4M4 16h4M24 16h4M8 8l3 3M21 21l3 3M24 8l-3 3M11 21l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1" /></svg>
  );
}
