import type { SVGProps } from 'react';

export default function Olive(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 4v24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><ellipse cx="12" cy="10" rx="4" ry="2.5" stroke="currentColor" strokeWidth="1" transform="rotate(-30 12 10)" /><ellipse cx="20" cy="14" rx="4" ry="2.5" stroke="currentColor" strokeWidth="1" transform="rotate(30 20 14)" /><ellipse cx="12" cy="20" rx="4" ry="2.5" stroke="currentColor" strokeWidth="1" transform="rotate(-30 12 20)" /></svg>
  );
}
