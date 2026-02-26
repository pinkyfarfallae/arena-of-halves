export default function Wish() {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6.5" strokeWidth="1" /><path d="M12 7v0.5M12 16.5v0.5M7 12h0.5M16.5 12h0.5" strokeWidth="1.5" /><path d="M9.5 9l1 1.5M14.5 9l-1 1.5M9.5 15l1-1.5M14.5 15l-1-1.5" strokeWidth="1" opacity="0.6" /></svg>
  );
}
