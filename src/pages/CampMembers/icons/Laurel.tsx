import type { SVGProps } from 'react';

export default function Laurel(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 40" fill="none" {...props}>
      <path d="M20 36C14 30 6 22 8 14C10 8 16 6 20 10C18 4 22 0 28 2C34 4 34 12 28 14C36 10 42 14 40 22C38 28 30 30 28 24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M100 36C106 30 114 22 112 14C110 8 104 6 100 10C102 4 98 0 92 2C86 4 86 12 92 14C84 10 78 14 80 22C82 28 90 30 92 24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
