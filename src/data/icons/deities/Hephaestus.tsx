import type { SVGProps } from 'react';

export default function Hephaestus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <rect x="28" y="8" width="8" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 36h24v6a4 4 0 01-4 4H24a4 4 0 01-4-4v-6z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M26 46v10M38 46v10M24 56h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 16h4M30 22h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
