import type { SVGProps } from 'react';

export default function Bolt(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M18 4L8 16h6l-4 12 12-14h-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
  );
}
