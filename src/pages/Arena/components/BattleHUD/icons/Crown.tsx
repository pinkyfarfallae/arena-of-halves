import type { SVGProps } from 'react';

export default function Crown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 8l4 12h12l4-12-5 4-5-8-5 8-5-4z" />
      <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="2" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="22" cy="8" r="1" fill="currentColor" stroke="none" />
      <line x1="6" y1="20" x2="18" y2="20" />
    </svg>
  );
}
