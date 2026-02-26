import type { SVGProps } from 'react';

export default function Rose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 10c-2 0-4 2-4 4 0 3 4 6 4 6s4-3 4-6c0-2-2-4-4-4z" stroke="currentColor" strokeWidth="1.2" /><path d="M13 12c-2-1-4 0-4 2s3 4 3 4" stroke="currentColor" strokeWidth="1" /><path d="M19 12c2-1 4 0 4 2s-3 4-3 4" stroke="currentColor" strokeWidth="1" /><path d="M16 20v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M13 24c2-1 3-2 3-4M19 22c-2 0-3 1-3 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
