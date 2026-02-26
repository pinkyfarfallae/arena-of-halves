import type { SVGProps } from 'react';

export default function Apollo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="32" cy="30" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="30" r="5" stroke="currentColor" strokeWidth="1" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <line key={a} x1="32" y1="30" x2={32 + 18 * Math.cos(a * Math.PI / 180)} y2={30 + 18 * Math.sin(a * Math.PI / 180)} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      ))}
    </svg>
  );
}
