import type { SVGProps } from 'react';

export default function Key(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" /><path d="M16 15v11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M16 22h4M16 26h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
