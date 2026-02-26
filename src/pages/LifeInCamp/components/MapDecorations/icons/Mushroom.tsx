import type { SVGProps } from 'react';

export default function Mushroom({ color, ...props }: SVGProps<SVGSVGElement> & { color: string }) {
  return (
    <svg viewBox="0 0 14 16" {...props}>
      <ellipse cx="7" cy="8" rx="6" ry="4.5" fill={color} opacity="0.22" />
      <rect x="5.5" y="8" width="3" height="6" rx="1" fill="#795548" opacity="0.2" />
      <circle cx="5" cy="7" r="1" fill="white" opacity="0.2" />
      <circle cx="8.5" cy="6.5" r="0.7" fill="white" opacity="0.15" />
    </svg>
  );
}
