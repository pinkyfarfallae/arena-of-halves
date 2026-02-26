import type { SVGProps } from 'react';

export default function Tree(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 28" {...props}>
      <path d="M10 4l-6 10h12L10 4z" fill="currentColor" opacity="0.12" />
      <path d="M10 8l-5 8h10L10 8z" fill="currentColor" opacity="0.08" />
      <path d="M10 16v8" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
    </svg>
  );
}
