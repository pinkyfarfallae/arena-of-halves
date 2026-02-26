import type { SVGProps } from 'react';

export default function RoseRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 30 40" fill="none" {...props}>
      <path d="M15 18v18" stroke="#6a9a62" strokeWidth="1" opacity="0.5" />
      <path d="M15 24c4-1 6 0 7 2-2 0-5-0.5-7-2z" fill="#8db88a" opacity="0.45" />
      <path d="M15 30c-3-2-6-1-7 0 2 1 5 1 7 0z" fill="#8db88a" opacity="0.35" />
      <path d="M15 10c-3-1-6 0-7 3 0 3 2 5 5 5z" fill="currentColor" opacity="0.35" />
      <path d="M15 10c3-1 6 0 7 3 0 3-2 5-5 5z" fill="currentColor" opacity="0.3" />
      <path d="M15 6c-2-2-5-2-6 1 0 3 3 5 6 4z" fill="currentColor" opacity="0.3" />
      <path d="M15 6c2-2 5-2 6 1 0 3-3 5-6 4z" fill="currentColor" opacity="0.25" />
      <path d="M15 8c-1-2-3-2-4 0 0 2 2 4 4 3z" fill="currentColor" opacity="0.5" />
      <path d="M15 8c1-2 3-2 4 0 0 2-2 4-4 3z" fill="currentColor" opacity="0.45" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" opacity="0.4" />
      <path d="M22 32c1-2 1-4-1-4s-2 2-1 4z" fill="currentColor" opacity="0.25" />
      <path d="M22 32v3" stroke="#6a9a62" strokeWidth="0.6" opacity="0.35" />
    </svg>
  );
}
