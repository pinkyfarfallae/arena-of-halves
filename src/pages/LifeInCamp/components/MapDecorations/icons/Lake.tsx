import type { SVGProps } from 'react';

export default function Lake(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 200 120" {...props}>
      <ellipse cx="100" cy="60" rx="80" ry="50" />
      <path d="M30 55c10-5 20-5 30 0s20 5 30 0 20-5 30 0 20 5 30 0" className="life__lake-wave" />
      <path d="M40 70c10-4 18-4 28 0s18 4 28 0 18-4 28 0" className="life__lake-wave" />
    </svg>
  );
}
