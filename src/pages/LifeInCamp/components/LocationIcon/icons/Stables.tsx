export default function Stables() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M4 12l12-6 12 6" fill="currentColor" opacity="0.1" />
      <rect x="4" y="12" width="24" height="14" rx="2" fill="currentColor" opacity="0.13" />
      <rect x="4" y="12" width="24" height="14" rx="2" strokeWidth="0.8" />
      <path d="M4 12l12-6 12 6" strokeWidth="1" />
      <rect x="12" y="18" width="8" height="8" fill="currentColor" opacity="0.18" strokeWidth="0.5" stroke="currentColor" />
      <path d="M16 18v-2" strokeWidth="0.8" />
    </svg>
  );
}
