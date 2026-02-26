import type { SVGProps } from 'react';

export default function Grape(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="14" cy="12" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="12" cy="17" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="20" cy="17" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="16" cy="22" r="3" stroke="currentColor" strokeWidth="1.1" /><path d="M16 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
