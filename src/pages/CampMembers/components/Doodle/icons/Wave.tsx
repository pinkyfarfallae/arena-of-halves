import type { SVGProps } from 'react';

export default function Wave(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M4 16c4-6 8 6 12 0s8 6 12 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  );
}
