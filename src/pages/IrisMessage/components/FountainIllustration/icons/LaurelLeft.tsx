import type { SVGProps } from 'react';

export default function LaurelLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 80" fill="none" {...props}>
      <path d="M34 76C30 56 24 32 20 8" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <ellipse cx="22" cy="12" rx="8" ry="3.5" transform="rotate(-35 22 12)" fill="currentColor" opacity="0.35" />
      <ellipse cx="26" cy="14" rx="6" ry="2.5" transform="rotate(-45 26 14)" fill="currentColor" opacity="0.2" />
      <ellipse cx="18" cy="20" rx="8" ry="3.5" transform="rotate(-15 18 20)" fill="currentColor" opacity="0.4" />
      <ellipse cx="24" cy="24" rx="7" ry="3" transform="rotate(-40 24 24)" fill="currentColor" opacity="0.3" />
      <ellipse cx="20" cy="30" rx="8" ry="3.5" transform="rotate(-25 20 30)" fill="currentColor" opacity="0.38" />
      <ellipse cx="25" cy="34" rx="7" ry="3" transform="rotate(-42 25 34)" fill="currentColor" opacity="0.25" />
      <ellipse cx="22" cy="40" rx="7" ry="3" transform="rotate(-20 22 40)" fill="currentColor" opacity="0.35" />
      <ellipse cx="26" cy="44" rx="6" ry="2.5" transform="rotate(-38 26 44)" fill="currentColor" opacity="0.22" />
      <ellipse cx="24" cy="50" rx="7" ry="3" transform="rotate(-28 24 50)" fill="currentColor" opacity="0.3" />
      <ellipse cx="28" cy="54" rx="6" ry="2.5" transform="rotate(-35 28 54)" fill="currentColor" opacity="0.18" />
      <ellipse cx="27" cy="62" rx="6" ry="2.5" transform="rotate(-30 27 62)" fill="currentColor" opacity="0.22" />
      <path d="M18 20l-4-1M20 30l-5-0.5M22 40l-4-1" stroke="currentColor" strokeWidth="0.3" opacity="0.25" />
    </svg>
  );
}
