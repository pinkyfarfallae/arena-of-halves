import type { SVGProps } from 'react';

export default function Male(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10.5" cy="13.5" r="5.5" />
      <path d="M16 8l4-4M20 4v5M20 4h-5" />
    </svg>
  );
}
