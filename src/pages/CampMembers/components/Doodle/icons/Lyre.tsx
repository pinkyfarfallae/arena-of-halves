import type { SVGProps } from 'react';

export default function Lyre(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M12 8c-2 6-2 12 0 18M20 8c2 6 2 12 0 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M12 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M14 12v8M16 10v10M18 12v8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" /></svg>
  );
}
