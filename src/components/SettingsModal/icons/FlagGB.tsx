import type { SVGProps } from 'react';

export default function FlagGB(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" {...props}>
      <rect width="16" height="12" fill="#012169"/>
      <path d="M0 0L16 12M16 0L0 12" stroke="white" strokeWidth="2"/>
      <path d="M0 0L16 12M16 0L0 12" stroke="#C8102E" strokeWidth="1.2"/>
      <path d="M8 0V12M0 6H16" stroke="white" strokeWidth="3.2"/>
      <path d="M8 0V12M0 6H16" stroke="#C8102E" strokeWidth="2"/>
    </svg>
  );
}
