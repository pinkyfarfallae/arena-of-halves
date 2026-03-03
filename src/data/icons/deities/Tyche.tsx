import type { SVGProps } from 'react';

export default function Tyche(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="1" />
      <path d="M32 16v32M16 32h32" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M22 22l20 20M42 22l-20 20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  );
}
