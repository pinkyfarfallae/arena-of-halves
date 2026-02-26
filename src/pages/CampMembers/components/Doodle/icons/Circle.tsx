import type { SVGProps } from 'react';

export default function Circle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><ellipse cx="16" cy="16" rx="10" ry="11" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 2" /></svg>
  );
}
