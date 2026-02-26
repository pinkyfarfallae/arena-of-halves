import type { SVGProps } from 'react';

export default function VineLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 36 28" fill="none" {...props}>
      <path d="M32 24C26 22 18 16 16 6" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
      <path d="M28 22c-3 0-5-2-4-5 2 0 5 2 4 5z" fill="currentColor" opacity="0.35" />
      <path d="M24 18c-3-1-4-3-2-5 2 0 4 2 2 5z" fill="currentColor" opacity="0.4" />
      <path d="M20 13c-2-1-3-3-1-5 2 1 3 3 1 5z" fill="currentColor" opacity="0.35" />
      <path d="M18 8c-2-1-2-4 0-4 1 0 2 2 0 4z" fill="currentColor" opacity="0.25" />
      <circle cx="30" cy="20" r="1.2" fill="currentColor" opacity="0.2" />
      <circle cx="32" cy="22" r="1" fill="currentColor" opacity="0.18" />
    </svg>
  );
}
