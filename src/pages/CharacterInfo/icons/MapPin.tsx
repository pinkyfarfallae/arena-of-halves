import type { SVGProps } from 'react';

export default function MapPin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
