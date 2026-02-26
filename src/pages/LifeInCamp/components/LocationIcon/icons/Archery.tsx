export default function Archery() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <circle cx="16" cy="16" r="10" fill="currentColor" opacity="0.06" />
      <circle cx="16" cy="16" r="6" fill="currentColor" opacity="0.1" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="16" cy="16" r="10" strokeWidth="0.8" />
      <circle cx="16" cy="16" r="6" strokeWidth="0.7" />
      <path d="M26 6l-8 8M26 6h-5M26 6v5" strokeWidth="1" />
    </svg>
  );
}
