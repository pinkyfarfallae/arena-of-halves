import type { SVGProps } from 'react';

export default function Shell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M6 22c2-10 8-16 10-16s8 6 10 16c-6-2-14-2-20 0z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M16 6v16M10 18l6-12M22 18l-6-12" stroke="currentColor" strokeWidth="0.8" /></svg>
  );
}
