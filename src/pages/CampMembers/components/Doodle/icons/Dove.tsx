import type { SVGProps } from 'react';

export default function Dove(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M8 18c2-6 8-8 14-6-2-4-8-6-12-2-2 2-3 5-2 8z" stroke="currentColor" strokeWidth="1.2" /><path d="M22 12c2 2 4 6 2 10l-8-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="20" cy="14" r="1" fill="currentColor" /></svg>
  );
}
