import type { SVGProps } from 'react';

export default function Sparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 6v20M6 16h20M9 9l14 14M23 9L9 23" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
