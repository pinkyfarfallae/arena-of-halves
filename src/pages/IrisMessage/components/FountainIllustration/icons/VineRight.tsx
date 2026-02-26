import type { SVGProps } from 'react';

export default function VineRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 36 28" fill="none" {...props}>
      <path d="M4 24C10 22 18 16 20 6" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
      <path d="M8 22c3 0 5-2 4-5-2 0-5 2-4 5z" fill="currentColor" opacity="0.35" />
      <path d="M12 18c3-1 4-3 2-5-2 0-4 2-2 5z" fill="currentColor" opacity="0.4" />
      <path d="M16 13c2-1 3-3 1-5-2 1-3 3-1 5z" fill="currentColor" opacity="0.35" />
      <path d="M18 8c2-1 2-4 0-4-1 0-2 2 0 4z" fill="currentColor" opacity="0.25" />
      <circle cx="6" cy="20" r="1.2" fill="currentColor" opacity="0.2" />
      <circle cx="4" cy="22" r="1" fill="currentColor" opacity="0.18" />
    </svg>
  );
}
