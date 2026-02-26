import type { SVGProps } from 'react';

export default function Trophy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M11 6h10v8c0 3-2 5-5 5s-5-2-5-5z" stroke="currentColor" strokeWidth="1.3" /><path d="M11 8H7c0 4 2 6 4 6M21 8h4c0 4-2 6-4 6" stroke="currentColor" strokeWidth="1.1" /><path d="M16 19v4M12 23h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
