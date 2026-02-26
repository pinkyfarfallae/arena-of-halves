export default function Woods() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M7 26l3-8-1 1-2-5 3 2-2-6 5 9-1-2 3 9" fill="currentColor" opacity="0.2" />
      <path d="M19 26l3-6-1 1-2-5 3 2-1-5 4 8-1-2 2 7" fill="currentColor" opacity="0.15" />
      <path d="M10 26V18M10 18l-5 8M10 18l5 8M10 18l-4-6M10 18l4-6M10 12l-3-5M10 12l3-5" strokeWidth="0.8" />
      <path d="M22 26V20M22 20l-4 6M22 20l4 6M22 20l-3-5M22 20l3-5" strokeWidth="0.8" />
      <circle cx="8" cy="10" r="2" fill="currentColor" opacity="0.08" />
      <circle cx="23" cy="17" r="1.5" fill="currentColor" opacity="0.06" />
    </svg>
  );
}
