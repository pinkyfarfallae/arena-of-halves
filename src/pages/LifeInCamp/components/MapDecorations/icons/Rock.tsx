import type { SVGProps } from 'react';

export default function Rock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 14" {...props}>
      <path d="M3 12l2-6 4-3 5 1 3 4 1 4z" fill="#9e9e9e" opacity="0.18" />
      <path d="M5 11l1-4 3-2 3 0.5 2 3z" fill="#bdbdbd" opacity="0.12" />
    </svg>
  );
}
