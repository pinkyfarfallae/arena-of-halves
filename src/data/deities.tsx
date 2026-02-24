import React from 'react';

export const DEITY_SVG: Record<string, React.ReactNode> = {
  zeus: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 6L28 22h-8l12 10-4 14 12-8 12 8-4-14 12-10h-8L32 6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 18v28M26 32h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 44l10-6M42 44l-10-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  poseidon: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 8v48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 8c0 6 8 6 8 0s8-6 8 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 16h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 22l12-4 12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
  demeter: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 56V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 28c-6-8-16-8-16 2 0 8 16 4 16-2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 22c6-10 18-8 16 4-2 8-16 2-16-4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 16c-4-10-2-16 4-12s4 12 0 12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M28 56h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  ares: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 10L18 28h8v26h12V28h8L32 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 54h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="20" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 34h16M26 40h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  athena: (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="24" r="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="24" r="6" stroke="currentColor" strokeWidth="1" />
      <circle cx="32" cy="24" r="2" fill="currentColor" />
      <path d="M20 36l-4 20h32l-4-20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M26 36v16M38 36v16M22 46h20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  apollo: (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="30" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="30" r="5" stroke="currentColor" strokeWidth="1" />
      {[0,45,90,135,180,225,270,315].map(a => (
        <line key={a} x1="32" y1="30" x2={32 + 18 * Math.cos(a * Math.PI / 180)} y2={30 + 18 * Math.sin(a * Math.PI / 180)} stroke="currentColor" strokeWidth="1" strokeLinecap="round" transform={`rotate(0)`} />
      ))}
    </svg>
  ),
  hephaestus: (
    <svg viewBox="0 0 64 64" fill="none">
      <rect x="28" y="8" width="8" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 36h24v6a4 4 0 01-4 4H24a4 4 0 01-4-4v-6z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M26 46v10M38 46v10M24 56h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M30 16h4M30 22h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  aphrodite: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 52C20 40 12 30 12 22a10 10 0 0120-2 10 10 0 0120 2c0 8-8 18-20 30z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 52C26 44 22 36 22 30a6 6 0 0110-1 6 6 0 0110 1c0 6-4 14-10 22z" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  hermes: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 8v48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="14" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 24c8-2 12 4 14 0s6-2 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 30c8-2 12 4 14 0s6-2 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 38l-8 8M40 38l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 44l4 4M46 48l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  dionysus: (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="26" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="38" cy="18" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="28" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="28" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="42" cy="28" r="4" stroke="currentColor" strokeWidth="1" />
      <path d="M32 34v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 52c0-4 4-6 8-4s8 0 8 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  hades: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 14v42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 14v-4a2 2 0 014 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 14v-4a2 2 0 00-4 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 20h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 56h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  persephone: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 54V30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 30c-5-8-14-6-14 2s14 4 14-2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 24c5-8 14-6 14 2s-14 4-14-2z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 18c-3-8-1-14 4-10s3 10-1 10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="14" r="4" stroke="currentColor" strokeWidth="1" />
      <circle cx="32" cy="14" r="1.5" fill="currentColor" />
      <path d="M26 54h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 48c4-2 8 2 10 0s6 2 10 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  hypnos: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M40 12a16 16 0 10-4 30 14 14 0 01-4-30z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="28" cy="30" r="2" fill="currentColor" />
      <circle cx="36" cy="28" r="1.5" fill="currentColor" />
      <circle cx="22" cy="26" r="1" fill="currentColor" />
      <path d="M18 48h28M22 52h20M26 56h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  nemesis: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 8l-6 18h12L32 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M32 26v22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 48h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="22" cy="38" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="42" cy="38" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 34v8M42 34v8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M18 54h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  hecate: (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="16" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 16a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M32 24v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 32l12 4 12-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 32v18M44 32v18M32 36v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="50" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="32" cy="50" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="44" cy="50" r="3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  hera: (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="16" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 16h16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M28 12h8M28 20h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M32 24v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20 30h24v4H20z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22 34v18M42 34v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 34v18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M18 52h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  artemis: (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="18" r="12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 18a12 12 0 0124 0" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="18" r="4" stroke="currentColor" strokeWidth="1" />
      <path d="M32 30v24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 40l8-6 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 54h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  iris: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M10 38c10-24 34-24 44 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 36c8-18 28-18 36 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M18 34c6-12 22-12 28 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="32" cy="26" r="6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="26" r="2.5" fill="currentColor" />
      <path d="M26 44h12M28 48h8M30 52h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  nike: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 8v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 16l14 12 14-12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 12l4 4M50 12l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="36" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M28 36l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 44l-4 12M40 44l4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 56h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  hebe: (
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M24 14c0-4 4-8 8-8s8 4 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 14h12v8a6 6 0 01-12 0v-8z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 14h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 28v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="42" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M26 42h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M32 48v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M26 54h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  tyche: (
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="10" stroke="currentColor" strokeWidth="1" />
      <path d="M32 16v32M16 32h32" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M22 22l20 20M42 22l-20 20" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  ),
};

export const DEITY_ALIASES: Record<string, string> = {
  persaphone: 'persephone',
};

export function parseDeityNames(raw: string): string[] {
  return raw.toLowerCase().trim()
    .split(/\s+and\s+/)
    .map(n => {
      const clean = n.replace(/[^a-z]/g, '');
      if (DEITY_ALIASES[clean]) return DEITY_ALIASES[clean];
      for (const key of Object.keys(DEITY_SVG)) {
        if (key.startsWith(clean) || clean.startsWith(key)) return key;
      }
      return clean;
    });
}
