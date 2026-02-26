import type { SVGProps } from 'react';

export default function Hecate(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      <circle cx="32" cy="16" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 16a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 24v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 32l12 4 12-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 32v18M44 32v18M32 36v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="50" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="32" cy="50" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="44" cy="50" r="3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
