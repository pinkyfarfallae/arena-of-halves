export default function Strawberry() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M16 8c-4 0-8 4-8 10s4 8 8 8 8-2 8-8-4-10-8-10z" fill="currentColor" opacity="0.25" />
      <path d="M16 10c-3 0-6 3-6 8s3 6 6 6 6-1.5 6-6-3-8-6-8z" fill="currentColor" opacity="0.12" />
      <path d="M16 8c-4 0-8 4-8 10s4 8 8 8 8-2 8-8-4-10-8-10z" strokeWidth="0.8" />
      <path d="M13 6c1-2 3-2 3-2s2 0 3 2" strokeWidth="1" />
      <path d="M12 14l4-2 4 2M12 18l4-2 4 2" strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}
