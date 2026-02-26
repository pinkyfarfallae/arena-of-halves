export default function Store() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <rect x="5" y="12" width="22" height="14" rx="2" fill="currentColor" opacity="0.13" />
      <rect x="5" y="12" width="22" height="14" rx="2" strokeWidth="0.8" />
      <path d="M5 12l2-6h18l2 6" fill="currentColor" opacity="0.1" />
      <path d="M5 12l2-6h18l2 6" strokeWidth="0.9" />
      <path d="M5 12c0 2 2 3 3.5 3s3.5-1 3.5-3" strokeWidth="0.7" />
      <path d="M12 12c0 2 2 3 3.5 3s3.5-1 3.5-3" strokeWidth="0.7" />
      <path d="M19 12c0 2 2 3 3.5 3s3.5-1 3.5-3" strokeWidth="0.7" />
      <rect x="13" y="19" width="6" height="7" fill="currentColor" opacity="0.18" strokeWidth="0.5" stroke="currentColor" />
    </svg>
  );
}
