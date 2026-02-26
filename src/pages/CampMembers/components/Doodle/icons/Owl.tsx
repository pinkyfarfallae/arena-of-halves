import type { SVGProps } from 'react';

export default function Owl(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="12" cy="14" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="20" cy="14" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="12" cy="14" r="1.5" fill="currentColor" /><circle cx="20" cy="14" r="1.5" fill="currentColor" /><path d="M16 18l-2 8h4z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /><path d="M10 8l2 4M22 8l-2 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
