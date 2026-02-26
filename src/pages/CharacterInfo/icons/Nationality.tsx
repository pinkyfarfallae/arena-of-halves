import type { SVGProps } from 'react';

export default function Nationality(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
