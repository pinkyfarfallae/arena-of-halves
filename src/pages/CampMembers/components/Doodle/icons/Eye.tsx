import type { SVGProps } from 'react';

export default function Eye(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M4 16c4-8 12-10 16-8s8 4 8 8-4 10-8 8-12 0-16-8z" stroke="currentColor" strokeWidth="1.2" /><circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="16" cy="16" r="1.5" fill="currentColor" /></svg>
  );
}
