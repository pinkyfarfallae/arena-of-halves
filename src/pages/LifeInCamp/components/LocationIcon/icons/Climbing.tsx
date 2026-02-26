export default function Climbing() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <rect x="8" y="4" width="16" height="24" rx="2" fill="currentColor" opacity="0.12" />
      <rect x="8" y="4" width="16" height="24" rx="2" strokeWidth="0.8" />
      <circle cx="12" cy="10" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="20" cy="14" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="14" cy="19" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="19" cy="24" r="2" fill="currentColor" opacity="0.3" />
      <path d="M6 28c2-1 3-3 4-3s2 2 4 2 2-2 4-2 2 3 4 3 3-1 4-2" className="life__lava-path" strokeWidth="1.2" />
    </svg>
  );
}
