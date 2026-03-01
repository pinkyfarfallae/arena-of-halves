import type { SVGProps } from 'react';

export default function Omega(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M6 20h3v-2.5a7 7 0 1110 0V20h3v-2H19v-1.5a7 7 0 00-14 0V18H2v2h4z" />
    </svg>
  );
}
