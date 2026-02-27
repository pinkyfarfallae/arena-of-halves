import type { SVGProps } from 'react';

export default function Eye(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" {...props}>
      <path d="M1 8s3-5.5 7-5.5S15 8 15 8s-3 5.5-7 5.5S1 8 1 8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
