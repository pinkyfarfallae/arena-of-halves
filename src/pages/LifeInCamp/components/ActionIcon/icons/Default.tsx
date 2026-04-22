import React from 'react';

export default function DefaultIcon() {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8l4 4-4 4M8 12h8" /></svg>;
}