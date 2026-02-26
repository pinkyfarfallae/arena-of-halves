import type { SVGProps } from 'react';

export default function Fish(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M6 16c4-6 12-8 18-4-6 0-12 2-18 4zm18-4c-4 6-12 8-18 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><circle cx="21" cy="14" r="1.2" fill="currentColor" /></svg>
  );
}
