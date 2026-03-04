import type { SVGProps } from 'react';

export default function Zeus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M32 6L28 22h-8l12 10-4 14 12-8 12 8-4-14 12-10h-8L32 6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 18v28M26 32h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 44l10-6M42 44l-10-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
