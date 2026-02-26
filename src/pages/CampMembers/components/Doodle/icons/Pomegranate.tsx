import type { SVGProps } from 'react';

export default function Pomegranate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.3" /><path d="M14 7h4l-2 3z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /><circle cx="13" cy="14" r="1.5" fill="currentColor" /><circle cx="19" cy="14" r="1.5" fill="currentColor" /><circle cx="16" cy="19" r="1.5" fill="currentColor" /></svg>
  );
}
