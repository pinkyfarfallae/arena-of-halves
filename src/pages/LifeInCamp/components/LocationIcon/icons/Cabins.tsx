export default function Cabins() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M4 16l6-6 6 6" fill="currentColor" opacity="0.12" />
      <rect x="5" y="16" width="10" height="8" rx="1" fill="currentColor" opacity="0.15" />
      <path d="M18 14l5-5 5 5" fill="currentColor" opacity="0.1" />
      <rect x="19" y="14" width="8" height="10" rx="1" fill="currentColor" opacity="0.13" />
      <path d="M4 16l6-6 6 6" strokeWidth="0.8" /><rect x="5" y="16" width="10" height="8" rx="1" strokeWidth="0.7" />
      <path d="M18 14l5-5 5 5" strokeWidth="0.8" /><rect x="19" y="14" width="8" height="10" rx="1" strokeWidth="0.7" />
      <rect x="8" y="19" width="4" height="5" fill="currentColor" opacity="0.2" strokeWidth="0.5" stroke="currentColor" />
    </svg>
  );
}
