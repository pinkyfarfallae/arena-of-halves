import type { SVGProps } from 'react';

export default function Scroll(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}><rect x="8" y="6" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M12 10h8M12 14h8M12 18h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>
  );
}
