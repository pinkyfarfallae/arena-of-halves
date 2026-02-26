import type { SVGProps } from 'react';

export default function Weight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 3L4 9h16L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 9v3a8 8 0 0016 0V9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
