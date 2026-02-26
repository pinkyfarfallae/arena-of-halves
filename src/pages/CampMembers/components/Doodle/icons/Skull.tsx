import type { SVGProps } from 'react';

export default function Skull(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="14" r="9" stroke="currentColor" strokeWidth="1.3" /><circle cx="12" cy="13" r="2.5" stroke="currentColor" strokeWidth="1" /><circle cx="20" cy="13" r="2.5" stroke="currentColor" strokeWidth="1" /><path d="M14 20v4M16 20v5M18 20v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
