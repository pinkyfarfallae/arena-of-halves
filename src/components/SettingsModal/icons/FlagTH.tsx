import type { SVGProps } from 'react';

export default function FlagTH(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" {...props}>
      <rect width="16" height="12" fill="#F4F5F8"/>
      <rect y="0" width="16" height="2" fill="#A51931"/>
      <rect y="10" width="16" height="2" fill="#A51931"/>
      <rect y="4" width="16" height="4" fill="#2D2A4A"/>
    </svg>
  );
}
