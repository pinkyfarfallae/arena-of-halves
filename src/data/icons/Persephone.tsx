import type { SVGProps } from 'react';

export default function Persephone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 54V30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 30c-5-8-14-6-14 2s14 4 14-2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 24c5-8 14-6 14 2s-14 4-14-2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 18c-3-8-1-14 4-10s3 10-1 10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="14" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="32" cy="14" r="1.5" fill="currentColor" />
      <path d="M26 54h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 48c4-2 8 2 10 0s6 2 10 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
