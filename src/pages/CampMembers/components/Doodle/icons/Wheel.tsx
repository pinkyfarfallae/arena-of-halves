import type { SVGProps } from 'react';

export default function Wheel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.3" /><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1" /><path d="M16 6v7M16 19v7M6 16h7M19 16h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
