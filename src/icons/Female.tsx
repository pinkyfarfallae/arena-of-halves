import type { SVGProps } from 'react';

export default function Female(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M12 14.5V22M9 19h6" />
    </svg>
  );
}
