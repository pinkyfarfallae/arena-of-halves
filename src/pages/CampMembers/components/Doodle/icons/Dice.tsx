import type { SVGProps } from 'react';

export default function Dice(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><rect x="6" y="6" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.3" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="20" cy="12" r="1.5" fill="currentColor" /><circle cx="16" cy="16" r="1.5" fill="currentColor" /><circle cx="12" cy="20" r="1.5" fill="currentColor" /><circle cx="20" cy="20" r="1.5" fill="currentColor" /></svg>
  );
}
