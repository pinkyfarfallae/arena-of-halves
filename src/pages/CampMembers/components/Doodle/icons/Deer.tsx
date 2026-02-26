import type { SVGProps } from 'react';

export default function Deer(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M12 28l4-10 4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="14" r="4" stroke="currentColor" strokeWidth="1.2" /><path d="M12 10l-4-6M10 8l-4 0M20 10l4-6M22 8l4 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
