import type { SVGProps } from 'react';

export default function Cerberus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="16" cy="8" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="22" cy="10" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="7" r="1" fill="currentColor" /><circle cx="21" cy="9" r="1" fill="currentColor" /><path d="M16 12v6c-2 2-4 4-4 6M16 18c2 2 4 4 4 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
