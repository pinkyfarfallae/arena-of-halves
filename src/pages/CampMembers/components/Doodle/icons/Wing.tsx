import type { SVGProps } from 'react';

export default function Wing(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M6 24c2-6 6-10 12-12-4 2-6 6-6 10M6 24c4-4 10-6 16-6-4 0-8 2-10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M10 20c2-4 6-6 10-6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
