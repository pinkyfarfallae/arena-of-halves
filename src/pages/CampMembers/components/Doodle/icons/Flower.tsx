import type { SVGProps } from 'react';

export default function Flower(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><circle cx="16" cy="14" r="3" stroke="currentColor" strokeWidth="1.2" /><ellipse cx="16" cy="7" rx="3" ry="4" stroke="currentColor" strokeWidth="1" /><ellipse cx="10" cy="12" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(-60 10 12)" /><ellipse cx="22" cy="12" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(60 22 12)" /><ellipse cx="12" cy="20" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(-30 12 20)" /><ellipse cx="20" cy="20" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(30 20 20)" /><path d="M16 22v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  );
}
