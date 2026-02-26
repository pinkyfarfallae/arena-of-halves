import type { SVGProps } from 'react';

export default function LaurelRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 80" fill="none" {...props}>
      <path d="M6 76C10 56 16 32 20 8" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <ellipse cx="18" cy="12" rx="8" ry="3.5" transform="rotate(35 18 12)" fill="currentColor" opacity="0.35" />
      <ellipse cx="14" cy="14" rx="6" ry="2.5" transform="rotate(45 14 14)" fill="currentColor" opacity="0.2" />
      <ellipse cx="22" cy="20" rx="8" ry="3.5" transform="rotate(15 22 20)" fill="currentColor" opacity="0.4" />
      <ellipse cx="16" cy="24" rx="7" ry="3" transform="rotate(40 16 24)" fill="currentColor" opacity="0.3" />
      <ellipse cx="20" cy="30" rx="8" ry="3.5" transform="rotate(25 20 30)" fill="currentColor" opacity="0.38" />
      <ellipse cx="15" cy="34" rx="7" ry="3" transform="rotate(42 15 34)" fill="currentColor" opacity="0.25" />
      <ellipse cx="18" cy="40" rx="7" ry="3" transform="rotate(20 18 40)" fill="currentColor" opacity="0.35" />
      <ellipse cx="14" cy="44" rx="6" ry="2.5" transform="rotate(38 14 44)" fill="currentColor" opacity="0.22" />
      <ellipse cx="16" cy="50" rx="7" ry="3" transform="rotate(28 16 50)" fill="currentColor" opacity="0.3" />
      <ellipse cx="12" cy="54" rx="6" ry="2.5" transform="rotate(35 12 54)" fill="currentColor" opacity="0.18" />
      <ellipse cx="13" cy="62" rx="6" ry="2.5" transform="rotate(30 13 62)" fill="currentColor" opacity="0.22" />
      <path d="M22 20l4-1M20 30l5-0.5M18 40l4-1" stroke="currentColor" strokeWidth="0.3" opacity="0.25" />
    </svg>
  );
}
