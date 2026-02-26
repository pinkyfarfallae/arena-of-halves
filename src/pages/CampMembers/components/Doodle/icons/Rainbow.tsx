import type { SVGProps } from 'react';

export default function Rainbow(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M4 24c0-12 6-18 12-18s12 6 12 18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M8 24c0-8 4-14 8-14s8 6 8 14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /><path d="M12 24c0-6 2-10 4-10s4 4 4 10" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" /></svg>
  );
}
