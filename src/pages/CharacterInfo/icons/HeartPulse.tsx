import type { SVGProps } from 'react';

export default function HeartPulse(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 21C12 21 4 15 4 9.5C4 6.5 6.5 4 9.5 4C11 4 12 5 12 5C12 5 13 4 14.5 4C17.5 4 20 6.5 20 9.5C20 15 12 21 12 21Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h4l2-3 2 6 2-3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
