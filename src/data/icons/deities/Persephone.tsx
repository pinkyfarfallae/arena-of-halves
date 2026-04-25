import type { SVGProps } from 'react';

export default function Persephone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" {...props}>
      {/* Crown — small, centered top */}
      <path d="M26 5l2-5 4 3 4-3 2 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25 6h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />

      {/* Small heart — upper left */}
      <path d="M11 26c0 0-6-3.5-6-7a3.5 3.5 0 0 1 6-2.5A3.5 3.5 0 0 1 17 19c0 3.5-6 7-6 7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Small pomegranate — upper right — calyx + round fruit */}
      <path d="M53 14v-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M50 14l-2-2M53 13v-2M56 14l2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="53" cy="20" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M49.5 18.5c1 3 7 3 7 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />

      {/* Rose stem */}
      <path d="M32 64V40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Left leaf */}
      <path d="M32 40c-5-8-14-6-14 2s14 4 14-2z" stroke="currentColor" strokeWidth="1.5" />
      {/* Right leaf */}
      <path d="M32 34c5-8 14-6 14 2s-14 4-14-2z" stroke="currentColor" strokeWidth="1.5" />
      {/* Tendril */}
      <path d="M32 28c-3-8-1-14 4-10s3 10-1 10" stroke="currentColor" strokeWidth="1.5" />
      {/* Flower head */}
      <circle cx="32" cy="24" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="32" cy="24" r="1.5" fill="currentColor" />
      {/* Base */}
      <path d="M26 64h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 58c4-2 8 2 10 0s6 2 10 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
