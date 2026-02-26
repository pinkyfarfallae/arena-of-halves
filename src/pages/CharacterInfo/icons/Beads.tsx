import type { SVGProps } from 'react';

export default function Beads(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="7" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 10l2.5-2M14.5 10l-2.5-2M9.5 14l2.5 2M14.5 14l-2.5 2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
