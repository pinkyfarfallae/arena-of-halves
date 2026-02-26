import type { SVGProps } from 'react';

export default function Shield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 4C10 4 6 8 6 16c0 6 4 10 10 14 6-4 10-8 10-14 0-8-4-12-10-12z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M16 10v12M10 16h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
