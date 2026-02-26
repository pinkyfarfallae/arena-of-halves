import type { SVGProps } from 'react';

export default function Clover(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="10" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="10" cy="16" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="22" cy="16" r="4" stroke="currentColor" strokeWidth="1.2" /><path d="M16 20v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  );
}
