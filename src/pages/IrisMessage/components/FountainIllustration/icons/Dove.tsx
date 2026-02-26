import type { SVGProps } from 'react';

export default function Dove(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 32" fill="none" {...props}>
      <ellipse cx="20" cy="20" rx="7" ry="5" fill="currentColor" opacity="0.5" />
      <circle cx="27" cy="16" r="3.5" fill="currentColor" opacity="0.5" />
      <path d="M30 16l3-0.5-3 1.5z" fill="currentColor" opacity="0.6" />
      <circle cx="28.5" cy="15.5" r="0.7" fill="currentColor" opacity="0.9" />
      <path d="M18 18C14 14 8 10 4 6c2 5 6 10 12 14z" fill="currentColor" opacity="0.4" />
      <path d="M16 17C12 12 6 8 2 4" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <path d="M22 18C24 12 28 6 34 2c-4 5-8 10-10 16z" fill="currentColor" opacity="0.35" />
      <path d="M13 22c-3 1-5 3-7 5 3-1 5-2 8-3z" fill="currentColor" opacity="0.35" />
      <path d="M13 23c-2 2-4 4-5 7 2-2 4-4 6-5z" fill="currentColor" opacity="0.25" />
      <path d="M31 16.5c2 1 4 2 6 2" stroke="#8db88a" strokeWidth="0.6" opacity="0.6" />
      <ellipse cx="36" cy="17" rx="2" ry="1" fill="#8db88a" opacity="0.4" transform="rotate(-15 36 17)" />
      <ellipse cx="34" cy="18.5" rx="1.5" ry="0.8" fill="#8db88a" opacity="0.35" transform="rotate(10 34 18.5)" />
    </svg>
  );
}
