import type { SVGProps } from 'react';

export default function Species(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 2C6.48 2 2 6 2 11c0 5.25 4.25 9 7 12 .68.75 1.52.75 2.2.1C14 20 22 16 22 11c0-5-4.48-9-10-9z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
