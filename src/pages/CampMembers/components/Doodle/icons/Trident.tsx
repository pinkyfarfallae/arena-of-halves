import type { SVGProps } from 'react';

export default function Trident(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 28V8M12 8v4M20 8v4M12 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="8" r="1.5" fill="currentColor" /></svg>
  );
}
