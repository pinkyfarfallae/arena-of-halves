import type { SVGProps } from 'react';

export default function Butterfly({ color, ...props }: SVGProps<SVGSVGElement> & { color: string }) {
  return (
    <svg viewBox="0 0 16 12" {...props}>
      <path d="M8 6c-2-4-6-4-6-1s4 4 6 1" fill={color} opacity="0.2" />
      <path d="M8 6c2-4 6-4 6-1s-4 4-6 1" fill={color} opacity="0.18" />
      <path d="M8 3v6" stroke="#5d4037" strokeWidth="0.4" opacity="0.2" />
    </svg>
  );
}
