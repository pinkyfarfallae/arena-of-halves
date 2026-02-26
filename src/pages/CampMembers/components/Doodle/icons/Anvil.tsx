import type { SVGProps } from 'react';

export default function Anvil(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M8 18h16v6H8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 18V12c0-2 3-4 6-4s6 2 6 4v6" stroke="currentColor" strokeWidth="1.2" /><path d="M12 24v4h8v-4" stroke="currentColor" strokeWidth="1.2" /></svg>
  );
}
