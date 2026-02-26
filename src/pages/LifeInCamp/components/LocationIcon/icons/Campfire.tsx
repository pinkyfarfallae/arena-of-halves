export default function Campfire() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M16 6c-2 4-6 6-6 12a6 6 0 0012 0c0-6-4-8-6-12z" fill="currentColor" opacity="0.2" />
      <path d="M16 10c-1.5 3-4.5 4.5-4.5 9a4.5 4.5 0 009 0c0-4.5-3-6-4.5-9z" fill="currentColor" opacity="0.15" />
      <path d="M16 6c-2 4-6 6-6 12a6 6 0 0012 0c0-6-4-8-6-12z" strokeWidth="0.8" />
      <path d="M16 12c-1 2-3 3-3 6a3 3 0 006 0c0-3-2-4-3-6z" fill="currentColor" opacity="0.3" strokeWidth="0.5" stroke="currentColor" />
      <path d="M10 26l-2 2M22 26l2 2M14 26v2M18 26v2" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}
