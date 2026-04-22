import type { SVGProps } from 'react';

export default function Morpheus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <path d="M28 20c-6-4-12 0-12 6s6 10 12 6v-12z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="25" cy="24" r="1.5" fill="currentColor" />
      <circle cx="22" cy="28" r="1" fill="currentColor" />
      <path d="M34 32c2-2 4-2 6 0s2 6-2 8-8 0-8-4 2-2 4-4z" stroke="currentColor" strokeWidth="1" />
      <circle cx="42" cy="16" r="2" stroke="currentColor" strokeWidth="1" />
      <circle cx="48" cy="22" r="1.5" stroke="currentColor" strokeWidth="1" />
      <circle cx="52" cy="18" r="1" fill="currentColor" />
      <path d="M18 46c4-2 8-2 12 0s8 2 12 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 52c2-3 6-3 8 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}