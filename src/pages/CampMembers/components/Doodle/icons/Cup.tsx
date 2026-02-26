import type { SVGProps } from 'react';

export default function Cup(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M10 8h12v8c0 4-3 6-6 6s-6-2-6-6z" stroke="currentColor" strokeWidth="1.3" /><path d="M16 22v4M12 26h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
