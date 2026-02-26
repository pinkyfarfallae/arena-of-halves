export default function BigHouse() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M5 16l11-10 11 10" fill="currentColor" opacity="0.1" />
      <rect x="8" y="16" width="16" height="10" rx="1" fill="currentColor" opacity="0.15" />
      <path d="M5 16l11-10 11 10" strokeWidth="1" />
      <rect x="8" y="16" width="16" height="10" rx="1" strokeWidth="0.8" />
      <rect x="13" y="20" width="6" height="6" fill="currentColor" opacity="0.2" strokeWidth="0.6" stroke="currentColor" />
      <rect x="10" y="18" width="3" height="3" fill="currentColor" opacity="0.25" strokeWidth="0.5" stroke="currentColor" />
      <rect x="19" y="18" width="3" height="3" fill="currentColor" opacity="0.25" strokeWidth="0.5" stroke="currentColor" />
    </svg>
  );
}
