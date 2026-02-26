import type { SVGProps } from 'react';

export default function Flower({ color, ...props }: SVGProps<SVGSVGElement> & { color: string }) {
  return (
    <svg viewBox="0 0 12 12" {...props}>
      <circle cx="6" cy="4" r="2" fill={color} opacity="0.25" />
      <circle cx="4" cy="6" r="2" fill={color} opacity="0.2" />
      <circle cx="8" cy="6" r="2" fill={color} opacity="0.2" />
      <circle cx="6" cy="6" r="1.2" fill="#fdd835" opacity="0.3" />
      <path d="M6 8v3" stroke="#66bb6a" strokeWidth="0.8" opacity="0.3" />
    </svg>
  );
}
