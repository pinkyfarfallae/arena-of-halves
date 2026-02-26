import type { SVGProps } from 'react';

export default function Star(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 4l3 8h8l-6 5 2 8-7-4-7 4 2-8-6-5h8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
  );
}
