import type { SVGProps } from 'react';

export default function Scepter(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 10v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="16" cy="8" r="4" stroke="currentColor" strokeWidth="1.3" /><path d="M12 28h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
