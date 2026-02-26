import type { SVGProps } from 'react';

export default function Hebe(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M24 14c0-4 4-8 8-8s8 4 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 14h12v8a6 6 0 01-12 0v-8z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 14h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 28v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="42" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M26 42h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M32 48v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 54h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
