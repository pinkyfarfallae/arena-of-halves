import type { SVGProps } from 'react';

export default function Palette(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="7" cy="5" r="2.5" fill="currentColor" opacity="0.8" />
      <circle cx="17" cy="5" r="2.5" fill="currentColor" opacity="0.6" />
      <circle cx="4" cy="12" r="2.5" fill="currentColor" opacity="0.7" />
      <circle cx="20" cy="12" r="2.5" fill="currentColor" opacity="0.5" />
      <circle cx="7" cy="19" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="17" cy="19" r="2.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
