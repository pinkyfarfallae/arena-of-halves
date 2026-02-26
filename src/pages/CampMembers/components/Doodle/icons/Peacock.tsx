import type { SVGProps } from 'react';

export default function Peacock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="22" r="3" stroke="currentColor" strokeWidth="1.2" /><path d="M16 19V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M8 6c2 4 6 6 8 4M24 6c-2 4-6 6-8 4M4 10c4 4 8 4 12 2M28 10c-4 4-8 4-12 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
