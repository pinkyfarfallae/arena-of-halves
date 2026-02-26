import type { SVGProps } from 'react';

export default function Flag({ color, ...props }: SVGProps<SVGSVGElement> & { color: string }) {
  return (
    <svg viewBox="0 0 12 20" {...props}>
      <path d="M3 2v16" stroke="#795548" strokeWidth="0.8" opacity="0.3" />
      <path d="M3 2l7 3-7 3z" fill={color} opacity="0.22" />
    </svg>
  );
}
