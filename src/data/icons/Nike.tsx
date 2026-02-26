import type { SVGProps } from 'react';

export default function Nike(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 8v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 16l14 12 14-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 12l4 4M50 12l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="36" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M28 36l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 44l-4 12M40 44l4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 56h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
