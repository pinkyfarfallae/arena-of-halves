import type { SVGProps } from 'react';

export default function Torch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><path d="M16 14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 14h8" stroke="currentColor" strokeWidth="1.2" /><path d="M14 14c-1-4 0-8 2-10s3 6 2 10" stroke="currentColor" strokeWidth="1.2" /></svg>
  );
}
