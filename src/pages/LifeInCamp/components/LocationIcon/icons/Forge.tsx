export default function Forge() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <rect x="10" y="18" width="12" height="6" fill="currentColor" opacity="0.15" />
      <path d="M13 6l3 5 3-5" fill="currentColor" opacity="0.2" />
      <path d="M6 24h20" strokeWidth="1" /><path d="M10 24v-6h12v6" strokeWidth="0.8" />
      <path d="M14 18v-4h4v4" strokeWidth="0.7" fill="currentColor" opacity="0.1" />
      <path d="M16 14v-3" strokeWidth="0.8" /><path d="M13 6l3 5 3-5" strokeWidth="0.8" />
      <circle cx="10" cy="8" r="2" fill="currentColor" opacity="0.15" />
      <circle cx="22" cy="10" r="1.5" fill="currentColor" opacity="0.12" />
      <circle cx="10" cy="8" r="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
