import type { SVGProps } from 'react';

export default function Colosseum(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 21h18" />
      <path d="M5 21V7" />
      <path d="M19 21V7" />
      <path d="M5 7h14" />
      <path d="M5 7l-2-3h18l-2 3" />
      <path d="M8 7v5" />
      <path d="M12 7v5" />
      <path d="M16 7v5" />
      <path d="M6 12h12" />
      <path d="M9 12v5a3 3 0 006 0v-5" />
    </svg>
  );
}
