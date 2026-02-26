import type { SVGProps } from 'react';

export default function Hammer(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><rect x="8" y="6" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" /></svg>
  );
}
