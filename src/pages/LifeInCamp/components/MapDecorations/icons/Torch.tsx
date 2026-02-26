import type { SVGProps } from 'react';

export default function Torch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 8 20" {...props}>
      <rect x="3" y="8" width="2" height="10" rx="0.5" fill="#795548" opacity="0.2" />
      <path d="M4 3c-1 2-2 3-2 5a2 2 0 004 0c0-2-1-3-2-5z" fill="#ff9800" opacity="0.25" />
      <path d="M4 5c-0.5 1-1 1.5-1 2.5a1 1 0 002 0c0-1-0.5-1.5-1-2.5z" fill="#ffeb3b" opacity="0.2" />
    </svg>
  );
}
