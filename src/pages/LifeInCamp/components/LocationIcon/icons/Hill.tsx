export default function Hill() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M4 27l10-18 6 10 4-6 4 14H4z" fill="currentColor" opacity="0.18" />
      <path d="M4 27l10-18 6 10 4-6 4 14H4z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="0.8" />
      <path d="M6 27l8-14 4 7 3-4 3 11" fill="currentColor" opacity="0.12" />
      <path d="M14 9v-4" strokeWidth="1.2" /><path d="M12 6.5h4" strokeWidth="1.2" />
      <circle cx="14" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
      <path d="M2 27h28" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}
