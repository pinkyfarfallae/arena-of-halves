import type { SVGProps } from 'react';

export default function Wreath(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M10 24c-4-4-6-10-4-14s6-4 10-2c4-2 8-2 10 2s0 10-4 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M16 26v-4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
