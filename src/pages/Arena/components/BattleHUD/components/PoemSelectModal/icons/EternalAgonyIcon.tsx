import type { SVGProps } from 'react';

/** Eternal Agony — extended duration / chains (linked rings or clock extend). */
export default function EternalAgonyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 6v4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="17" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="17" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
