export default function Armory() {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...props}>
      <path d="M16 4l8 4v8c0 6-4 10-8 12-4-2-8-6-8-12V8l8-4z" fill="currentColor" opacity="0.15" />
      <path d="M16 6l6 3v6c0 4.5-3 7.5-6 9-3-1.5-6-4.5-6-9V9l6-3z" fill="currentColor" opacity="0.1" />
      <path d="M16 4l8 4v8c0 6-4 10-8 12-4-2-8-6-8-12V8l8-4z" strokeWidth="0.8" />
      <path d="M12 14l3 3 5-6" strokeWidth="1.2" />
    </svg>
  );
}
