import type { SVGProps } from 'react';

export default function Coin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.3" /><circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="0.8" /><path d="M14 12v8c0 1 1 2 2 2s2-1 2-2v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
