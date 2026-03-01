import type { SVGProps } from 'react';

export default function Skull(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2C7.03 2 3 6.03 3 11c0 2.76 1.23 5.23 3.17 6.9L6 22h4v-2h4v2h4l-.17-4.1C19.77 16.23 21 13.76 21 11c0-4.97-4.03-9-9-9z" />
      <circle cx="9" cy="11" r="2" />
      <circle cx="15" cy="11" r="2" />
      <path d="M10 16h4" />
      <line x1="11" y1="16" x2="11" y2="18" />
      <line x1="13" y1="16" x2="13" y2="18" />
    </svg>
  );
}
