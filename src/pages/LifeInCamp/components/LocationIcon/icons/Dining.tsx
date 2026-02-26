export default function Dining() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M6 12v10a2 2 0 002 2h16a2 2 0 002-2V12" fill="currentColor" opacity="0.12" />
      <path d="M4 12h24" strokeWidth="1.2" />
      <path d="M6 12v10a2 2 0 002 2h16a2 2 0 002-2V12" strokeWidth="0.8" />
      <path d="M8 8v4M16 6v6M24 8v4" strokeWidth="1" />
      <circle cx="16" cy="4" r="1.5" fill="currentColor" opacity="0.35" />
      <rect x="10" y="15" width="12" height="6" rx="1" fill="currentColor" opacity="0.08" />
    </svg>
  );
}
