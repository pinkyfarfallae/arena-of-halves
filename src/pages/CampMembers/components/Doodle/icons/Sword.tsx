import type { SVGProps } from 'react';

export default function Sword(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      {...props}
    >
      <path d="M16 4v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 20h8M14 22v4h4v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
