export default function Amphitheater() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M6 20a14 8 0 0120 0v4H6z" fill="currentColor" opacity="0.1" />
      <path d="M8 17a11 6 0 0116 0" fill="currentColor" opacity="0.08" />
      <path d="M6 20a14 8 0 0120 0" strokeWidth="1" />
      <path d="M8 17a11 6 0 0116 0" strokeWidth="0.8" opacity="0.7" />
      <path d="M10 14a8 4 0 0112 0" strokeWidth="0.7" opacity="0.5" />
      <rect x="13" y="22" width="6" height="4" rx="1" fill="currentColor" opacity="0.2" strokeWidth="0.6" stroke="currentColor" />
    </svg>
  );
}
