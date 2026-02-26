import type { SVGProps } from 'react';

export default function Heart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 26C10 20 4 16 4 11a5 5 0 019-1 5 5 0 019 1c0 5-6 9-6 15z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
  );
}
