import type { SVGProps } from 'react';

export default function Iris(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M10 38c10-24 34-24 44 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 36c8-18 28-18 36 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M18 34c6-12 22-12 28 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="32" cy="26" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="26" r="2.5" fill="currentColor" />
      <path d="M26 44h12M28 48h8M30 52h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
