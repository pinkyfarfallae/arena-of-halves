import type { SVGProps } from 'react';

export default function Gender(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 13v8M9 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
