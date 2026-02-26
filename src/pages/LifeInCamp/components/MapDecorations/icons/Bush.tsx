import type { SVGProps } from 'react';

export default function Bush(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 16" {...props}>
      <ellipse cx="12" cy="10" rx="10" ry="6" fill="#4caf50" opacity="0.2" />
      <ellipse cx="8" cy="9" rx="6" ry="5" fill="#66bb6a" opacity="0.15" />
      <ellipse cx="16" cy="9" rx="6" ry="5" fill="#43a047" opacity="0.15" />
    </svg>
  );
}
