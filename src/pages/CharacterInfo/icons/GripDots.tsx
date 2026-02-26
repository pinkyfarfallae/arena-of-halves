import type { SVGProps } from 'react';

export default function GripDots(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 6 14" fill="currentColor" {...props}>
      <circle cx="1.5" cy="2" r="1" /><circle cx="4.5" cy="2" r="1" />
      <circle cx="1.5" cy="7" r="1" /><circle cx="4.5" cy="7" r="1" />
      <circle cx="1.5" cy="12" r="1" /><circle cx="4.5" cy="12" r="1" />
    </svg>
  );
}
