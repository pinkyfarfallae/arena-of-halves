import type { SVGProps } from 'react';

export default function Mirror(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="13" r="8" stroke="currentColor" strokeWidth="1.3" /><path d="M16 21v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 27h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  );
}
