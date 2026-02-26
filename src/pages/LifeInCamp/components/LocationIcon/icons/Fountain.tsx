export default function Fountain() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M10 20c0-3 3-6 6-6s6 3 6 6" fill="currentColor" opacity="0.1" />
      <rect x="10" y="20" width="12" height="4" fill="currentColor" opacity="0.13" />
      <path d="M16 10c-3-6 3-6 0-2s3 4 0 2" strokeWidth="1" />
      <path d="M16 14v6" strokeWidth="0.8" />
      <path d="M10 20c0-3 3-6 6-6s6 3 6 6" strokeWidth="0.8" />
      <path d="M8 20h16" strokeWidth="1" /><path d="M10 20v4h12v-4" strokeWidth="0.7" />
      <path d="M8 24h16" strokeWidth="1" />
      <path d="M12 4c-2 3 0 5 4 6" opacity="0.3" strokeWidth="0.8" />
      <path d="M20 4c2 3 0 5-4 6" opacity="0.3" strokeWidth="0.8" />
      <circle cx="14" cy="7" r="1.5" fill="currentColor" opacity="0.08" />
      <circle cx="18" cy="7" r="1.5" fill="currentColor" opacity="0.08" />
    </svg>
  );
}
