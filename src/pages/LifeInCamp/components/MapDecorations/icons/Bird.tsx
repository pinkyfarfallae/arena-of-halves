import type { SVGProps } from 'react';

export default function Bird(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 8" {...props}>
      <path d="M1 6c2-3 4-4 7-2 3-2 5-1 7 2" stroke="#5d4037" strokeWidth="0.8" fill="none" opacity="0.2" />
    </svg>
  );
}
