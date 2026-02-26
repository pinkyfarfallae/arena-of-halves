import type { SVGProps } from 'react';

export default function Flame(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 4c-4 8-8 12-6 18 1 4 4 6 6 6s5-2 6-6c2-6-2-10-6-18z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M16 18c-1 3 0 5 2 5s3-1 2-5" stroke="currentColor" strokeWidth="1" /></svg>
  );
}
