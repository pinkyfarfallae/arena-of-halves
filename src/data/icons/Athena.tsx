import type { SVGProps } from 'react';

export default function Athena(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="32" cy="24" r="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="24" r="6" stroke="currentColor" strokeWidth="1" />
      <circle cx="32" cy="24" r="2" fill="currentColor" />
      <path d="M20 36l-4 20h32l-4-20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M26 36v16M38 36v16M22 46h20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
