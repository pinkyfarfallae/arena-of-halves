import type { SVGProps } from 'react';

/** Disoriented — unfocused / blurred eyes (two circles with swirl). */
export default function DisorientedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="9" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 12c0-1.5 1-2.5 2-2.5M15 12c0 1.5-1 2.5-2 2.5M6 8Q4 12 6 16M18 8q2 4 0 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
