import type { SVGProps } from 'react';

export default function Crown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path 
        d="M2.5 16h19l-3-9-4.5 5L12 8l-2 4L5.5 7l-3 9z" 
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="2" y="16" width="20" height="3" rx="0.5" fill="currentColor" />
      <circle cx="5.5" cy="7" r="1.2" fill="currentColor" />
      <circle cx="12" cy="5.5" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="7" r="1.2" fill="currentColor" />
    </svg>
  );
}
