export default function Lake() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <ellipse cx="16" cy="18" rx="12" ry="6" fill="currentColor" opacity="0.15" />
      <ellipse cx="16" cy="17" rx="9" ry="4" fill="currentColor" opacity="0.1" />
      <path d="M4 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0" strokeWidth="1" />
      <path d="M6 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0" strokeWidth="0.8" opacity="0.6" />
      <path d="M14 10l-2-4h4l-2 4zM14 10v3" strokeWidth="0.8" />
      <path d="M8 19c3-1 5-1 8 0" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}
