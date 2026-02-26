import type { SVGProps } from 'react';

export default function SteppingStone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 8" {...props}>
      <ellipse cx="5" cy="4" rx="4" ry="2.5" fill="#9e9e9e" opacity="0.14" />
      <ellipse cx="13" cy="4.5" rx="5" ry="2.8" fill="#8d6e63" opacity="0.12" />
    </svg>
  );
}
