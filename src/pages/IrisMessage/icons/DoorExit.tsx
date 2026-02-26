import type { SVGProps } from 'react';

export default function DoorExit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="9" y="3" width="11" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="12.5" r="1" fill="currentColor" />
      <path d="M9 12H3M5.5 9.5L3 12l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
