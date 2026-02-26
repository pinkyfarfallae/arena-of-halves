import type { SVGProps } from 'react';

export default function Grass(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 12" {...props}>
      <path d="M4 11c0-4 1-7 2-9" stroke="#66bb6a" strokeWidth="0.8" fill="none" opacity="0.25" />
      <path d="M8 11c0-3 0-6 0-8" stroke="#4caf50" strokeWidth="0.8" fill="none" opacity="0.3" />
      <path d="M12 11c0-4-1-6-2-8" stroke="#81c784" strokeWidth="0.8" fill="none" opacity="0.2" />
    </svg>
  );
}
