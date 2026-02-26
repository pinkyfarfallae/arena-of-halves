export default function Arena() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <ellipse cx="16" cy="18" rx="12" ry="7" fill="currentColor" opacity="0.12" />
      <path d="M4 18V14c0-4 5.4-7 12-7s12 3 12 7v4" fill="currentColor" opacity="0.08" />
      <ellipse cx="16" cy="18" rx="12" ry="7" strokeWidth="1" />
      <path d="M4 18V14c0-4 5.4-7 12-7s12 3 12 7v4" strokeWidth="0.8" />
      <path d="M8 11v7M12 9v9M20 9v9M24 11v7" strokeWidth="0.7" opacity="0.5" />
    </svg>
  );
}
