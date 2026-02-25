import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Character, fetchAllCharacters } from '../../data/characters';
import { DEITY_SVG, parseDeityNames } from '../../data/deities';
import { useAuth } from '../../hooks/useAuth';
import './CampMembers.scss';

/* ── Deterministic hash for stable random per card ── */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ── Decoration types ── */
type Deco = 'pin' | 'tape-l' | 'tape-r' | 'tape-c';
const DECOS: Deco[] = ['pin', 'pin', 'pin', 'tape-l', 'tape-r', 'tape-c'];

/* ── Pushpin ── */
function Pin({ color }: { color: string }) {
  return (
    <svg className="camp__pin" viewBox="0 0 28 36" fill="none">
      <ellipse cx="14" cy="28" rx="5" ry="1.5" fill="rgba(0,0,0,0.12)" />
      <path d="M14 18v10" stroke="#888" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="11" r="8" fill={color} />
      <circle cx="14" cy="11" r="5.5" fill={`color-mix(in srgb, ${color} 65%, #fff)`} />
      <ellipse cx="12" cy="9" rx="2.5" ry="1.8" fill={`color-mix(in srgb, ${color} 30%, #fff)`} opacity="0.8" />
    </svg>
  );
}

/* ── Tape strip ── */
function Tape({ side, color }: { side: 'l' | 'r' | 'c'; color: string }) {
  return (
    <div className={`camp__tape camp__tape--${side}`}>
      <svg viewBox="0 0 70 20" fill="none" preserveAspectRatio="none">
        <rect x="0" y="2" width="70" height="16" rx="1" fill={`color-mix(in srgb, ${color} 35%, #d2c39b)`} />
        <rect x="0" y="2" width="70" height="16" rx="1" fill="rgba(255,255,255,0.18)" />
      </svg>
    </div>
  );
}

/* ── Doodle types & deity mapping ── */
type DoodleType =
  | 'star' | 'bolt' | 'arrow' | 'heart' | 'swirl' | 'sparkle' | 'circle' | 'wave'
  | 'skull' | 'gem' | 'crown' | 'flame'
  | 'leaf' | 'wheat' | 'flower' | 'vine'
  | 'rose' | 'dove' | 'mirror'
  | 'trident' | 'shell' | 'fish'
  | 'sword' | 'shield' | 'spear'
  | 'owl' | 'scroll' | 'olive'
  | 'lyre' | 'sun' | 'laurel'
  | 'hammer' | 'gear' | 'anvil'
  | 'wing' | 'coin' | 'caduceus'
  | 'grape' | 'cup' | 'ivy'
  | 'moon' | 'cloud' | 'zzz'
  | 'scales' | 'eye'
  | 'torch' | 'key'
  | 'peacock' | 'scepter'
  | 'bow' | 'deer'
  | 'rainbow' | 'prism'
  | 'wreath' | 'trophy'
  | 'goblet' | 'youth'
  | 'wheel' | 'clover' | 'dice'
  | 'pomegranate'
  | 'cerberus';

const GENERIC_DOODLES: DoodleType[] = ['star', 'bolt', 'arrow', 'heart', 'swirl', 'sparkle', 'circle', 'wave'];

const DEITY_DOODLES: Record<string, DoodleType[]> = {
  zeus:       ['bolt', 'star', 'cloud', 'crown', 'sparkle', 'flame'],
  poseidon:   ['trident', 'wave', 'shell', 'fish', 'swirl', 'circle'],
  demeter:    ['leaf', 'wheat', 'flower', 'vine', 'circle', 'swirl'],
  ares:       ['sword', 'shield', 'spear', 'flame', 'star', 'bolt'],
  athena:     ['owl', 'scroll', 'shield', 'olive', 'star', 'sparkle'],
  apollo:     ['lyre', 'sun', 'laurel', 'arrow', 'star', 'sparkle'],
  hephaestus: ['hammer', 'gear', 'anvil', 'flame', 'sparkle', 'bolt'],
  aphrodite:  ['heart', 'rose', 'dove', 'mirror', 'sparkle', 'swirl'],
  hermes:     ['wing', 'coin', 'caduceus', 'arrow', 'star', 'swirl'],
  dionysus:   ['grape', 'cup', 'ivy', 'vine', 'swirl', 'circle'],
  hades:      ['skull', 'gem', 'crown', 'flame', 'cerberus', 'star'],
  persephone: ['flower', 'pomegranate', 'leaf', 'rose', 'swirl', 'heart'],
  hypnos:     ['moon', 'cloud', 'zzz', 'star', 'swirl', 'circle'],
  nemesis:    ['scales', 'sword', 'eye', 'wing', 'star', 'circle'],
  hecate:     ['torch', 'moon', 'key', 'star', 'sparkle', 'circle'],
  hera:       ['crown', 'peacock', 'scepter', 'flower', 'star', 'sparkle'],
  artemis:    ['moon', 'bow', 'deer', 'arrow', 'star', 'sparkle'],
  iris:       ['rainbow', 'prism', 'wing', 'cloud', 'sparkle', 'star'],
  nike:       ['wing', 'wreath', 'trophy', 'star', 'sparkle', 'bolt'],
  hebe:       ['goblet', 'youth', 'flower', 'cup', 'sparkle', 'star'],
  tyche:      ['wheel', 'coin', 'clover', 'dice', 'star', 'sparkle'],
};

/* 16 position slots scattered around the photo */
type DoodlePos = 'tl' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br' | 'itl' | 'itr' | 'ibl' | 'ibr' | 'ml2' | 'mr2' | 'bl2' | 'br2';
const DOODLE_POSITIONS: DoodlePos[] = ['tl', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br', 'itl', 'itr', 'ibl', 'ibr', 'ml2', 'mr2', 'bl2', 'br2'];

function Doodle({ type, pos }: { type: DoodleType; pos: DoodlePos }) {
  const cls = `camp__doodle camp__doodle--${pos}`;
  const svgProps = { className: cls, viewBox: '0 0 32 32', fill: 'none' as const, 'aria-hidden': true as const };

  switch (type) {
    /* ── generic ── */
    case 'star':
      return <svg {...svgProps}><path d="M16 4l3 8h8l-6 5 2 8-7-4-7 4 2-8-6-5h8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
    case 'bolt':
      return <svg {...svgProps}><path d="M18 4L8 16h6l-4 12 12-14h-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
    case 'arrow':
      return <svg {...svgProps}><path d="M6 26C10 22 14 14 26 8M26 8l-6 1M26 8l-1 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'heart':
      return <svg {...svgProps}><path d="M16 26C10 20 4 16 4 11a5 5 0 019-1 5 5 0 019 1c0 5-6 9-6 15z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>;
    case 'swirl':
      return <svg {...svgProps}><path d="M8 24C6 16 10 8 18 8s10 6 6 12c-3 4-8 2-6-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
    case 'sparkle':
      return <svg {...svgProps}><path d="M16 6v20M6 16h20M9 9l14 14M23 9L9 23" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'circle':
      return <svg {...svgProps}><ellipse cx="16" cy="16" rx="10" ry="11" stroke="currentColor" strokeWidth="1.3" strokeDasharray="3 2" /></svg>;
    case 'wave':
      return <svg {...svgProps}><path d="M4 16c4-6 8 6 12 0s8 6 12 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
    /* ── Hades ── */
    case 'skull':
      return <svg {...svgProps}><circle cx="16" cy="14" r="9" stroke="currentColor" strokeWidth="1.3" /><circle cx="12" cy="13" r="2.5" stroke="currentColor" strokeWidth="1" /><circle cx="20" cy="13" r="2.5" stroke="currentColor" strokeWidth="1" /><path d="M14 20v4M16 20v5M18 20v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'gem':
      return <svg {...svgProps}><path d="M10 12h12l-6 16z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 12l3-6h6l3 6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M13 6l3 6 3-6" stroke="currentColor" strokeWidth="1" /></svg>;
    case 'crown':
      return <svg {...svgProps}><path d="M6 22V10l5 6 5-8 5 8 5-6v12z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>;
    case 'flame':
      return <svg {...svgProps}><path d="M16 4c-4 8-8 12-6 18 1 4 4 6 6 6s5-2 6-6c2-6-2-10-6-18z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M16 18c-1 3 0 5 2 5s3-1 2-5" stroke="currentColor" strokeWidth="1" /></svg>;
    case 'cerberus':
      return <svg {...svgProps}><circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="16" cy="8" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="22" cy="10" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="7" r="1" fill="currentColor" /><circle cx="21" cy="9" r="1" fill="currentColor" /><path d="M16 12v6c-2 2-4 4-4 6M16 18c2 2 4 4 4 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    /* ── Demeter ── */
    case 'leaf':
      return <svg {...svgProps}><path d="M16 28C8 24 4 16 8 8c6 2 12 8 12 16" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 16c4 2 6 6 8 10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'wheat':
      return <svg {...svgProps}><path d="M16 28V8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M16 12l-5-4M16 16l-5-4M16 20l-5-4M16 12l5-4M16 16l5-4M16 20l5-4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'flower':
      return <svg {...svgProps}><circle cx="16" cy="14" r="3" stroke="currentColor" strokeWidth="1.2" /><ellipse cx="16" cy="7" rx="3" ry="4" stroke="currentColor" strokeWidth="1" /><ellipse cx="10" cy="12" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(-60 10 12)" /><ellipse cx="22" cy="12" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(60 22 12)" /><ellipse cx="12" cy="20" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(-30 12 20)" /><ellipse cx="20" cy="20" rx="3" ry="4" stroke="currentColor" strokeWidth="1" transform="rotate(30 20 20)" /><path d="M16 22v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'vine':
      return <svg {...svgProps}><path d="M8 28c4-8 4-16 8-22" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M12 18c-3-1-4-4-2-5s4 1 3 4M14 12c-3-2-3-5-1-5s3 2 2 5M10 24c-3 0-5-2-4-4s4 0 4 3" stroke="currentColor" strokeWidth="1" /></svg>;
    /* ── Aphrodite / Rose ── */
    case 'rose':
      return <svg {...svgProps}><path d="M16 10c-2 0-4 2-4 4 0 3 4 6 4 6s4-3 4-6c0-2-2-4-4-4z" stroke="currentColor" strokeWidth="1.2" /><path d="M13 12c-2-1-4 0-4 2s3 4 3 4" stroke="currentColor" strokeWidth="1" /><path d="M19 12c2-1 4 0 4 2s-3 4-3 4" stroke="currentColor" strokeWidth="1" /><path d="M16 20v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M13 24c2-1 3-2 3-4M19 22c-2 0-3 1-3 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'dove':
      return <svg {...svgProps}><path d="M8 18c2-6 8-8 14-6-2-4-8-6-12-2-2 2-3 5-2 8z" stroke="currentColor" strokeWidth="1.2" /><path d="M22 12c2 2 4 6 2 10l-8-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="20" cy="14" r="1" fill="currentColor" /></svg>;
    case 'mirror':
      return <svg {...svgProps}><circle cx="16" cy="13" r="8" stroke="currentColor" strokeWidth="1.3" /><path d="M16 21v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 27h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
    /* ── Poseidon ── */
    case 'trident':
      return <svg {...svgProps}><path d="M16 28V8M12 8v4M20 8v4M12 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="8" r="1.5" fill="currentColor" /></svg>;
    case 'shell':
      return <svg {...svgProps}><path d="M6 22c2-10 8-16 10-16s8 6 10 16c-6-2-14-2-20 0z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M16 6v16M10 18l6-12M22 18l-6-12" stroke="currentColor" strokeWidth="0.8" /></svg>;
    case 'fish':
      return <svg {...svgProps}><path d="M6 16c4-6 12-8 18-4-6 0-12 2-18 4zm18-4c-4 6-12 8-18 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><circle cx="21" cy="14" r="1.2" fill="currentColor" /></svg>;
    /* ── Ares ── */
    case 'sword':
      return <svg {...svgProps}><path d="M16 4v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 20h8M14 22v4h4v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'shield':
      return <svg {...svgProps}><path d="M16 4C10 4 6 8 6 16c0 6 4 10 10 14 6-4 10-8 10-14 0-8-4-12-10-12z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M16 10v12M10 16h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'spear':
      return <svg {...svgProps}><path d="M16 6v22" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M12 10l4-6 4 6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>;
    /* ── Athena ── */
    case 'owl':
      return <svg {...svgProps}><circle cx="12" cy="14" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="20" cy="14" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="12" cy="14" r="1.5" fill="currentColor" /><circle cx="20" cy="14" r="1.5" fill="currentColor" /><path d="M16 18l-2 8h4z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /><path d="M10 8l2 4M22 8l-2 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'scroll':
      return <svg {...svgProps}><rect x="8" y="6" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.3" /><path d="M12 10h8M12 14h8M12 18h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'olive':
      return <svg {...svgProps}><path d="M16 4v24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><ellipse cx="12" cy="10" rx="4" ry="2.5" stroke="currentColor" strokeWidth="1" transform="rotate(-30 12 10)" /><ellipse cx="20" cy="14" rx="4" ry="2.5" stroke="currentColor" strokeWidth="1" transform="rotate(30 20 14)" /><ellipse cx="12" cy="20" rx="4" ry="2.5" stroke="currentColor" strokeWidth="1" transform="rotate(-30 12 20)" /></svg>;
    /* ── Apollo ── */
    case 'lyre':
      return <svg {...svgProps}><path d="M12 8c-2 6-2 12 0 18M20 8c2 6 2 12 0 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M12 8h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M14 12v8M16 10v10M18 12v8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" /></svg>;
    case 'sun':
      return <svg {...svgProps}><circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1.3" /><path d="M16 4v4M16 24v4M4 16h4M24 16h4M8 8l3 3M21 21l3 3M24 8l-3 3M11 21l-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'laurel':
      return <svg {...svgProps}><path d="M16 28V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M16 14c-4-2-8-1-7 2s5 2 7 0M16 20c-4-1-7 1-5 3s5 1 5-1M16 14c4-2 8-1 7 2s-5 2-7 0M16 20c4-1 7 1 5 3s-5 1-5-1" stroke="currentColor" strokeWidth="1" /></svg>;
    /* ── Hephaestus ── */
    case 'hammer':
      return <svg {...svgProps}><path d="M16 14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><rect x="8" y="6" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" /></svg>;
    case 'gear':
      return <svg {...svgProps}><circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1.3" /><path d="M16 4v4M16 24v4M4 16h4M24 16h4M8 8l3 3M21 21l3 3M24 8l-3 3M11 21l-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1" /></svg>;
    case 'anvil':
      return <svg {...svgProps}><path d="M8 18h16v6H8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 18V12c0-2 3-4 6-4s6 2 6 4v6" stroke="currentColor" strokeWidth="1.2" /><path d="M12 24v4h8v-4" stroke="currentColor" strokeWidth="1.2" /></svg>;
    /* ── Hermes ── */
    case 'wing':
      return <svg {...svgProps}><path d="M6 24c2-6 6-10 12-12-4 2-6 6-6 10M6 24c4-4 10-6 16-6-4 0-8 2-10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M10 20c2-4 6-6 10-6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'coin':
      return <svg {...svgProps}><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.3" /><circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="0.8" /><path d="M14 12v8c0 1 1 2 2 2s2-1 2-2v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'caduceus':
      return <svg {...svgProps}><path d="M16 6v22" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M10 10c4 2 8 2 12 0M10 16c4 2 8 2 12 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="1" /></svg>;
    /* ── Dionysus ── */
    case 'grape':
      return <svg {...svgProps}><circle cx="14" cy="12" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="12" cy="17" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="20" cy="17" r="3" stroke="currentColor" strokeWidth="1.1" /><circle cx="16" cy="22" r="3" stroke="currentColor" strokeWidth="1.1" /><path d="M16 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'cup':
      return <svg {...svgProps}><path d="M10 8h12v8c0 4-3 6-6 6s-6-2-6-6z" stroke="currentColor" strokeWidth="1.3" /><path d="M16 22v4M12 26h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'ivy':
      return <svg {...svgProps}><path d="M8 28c4-8 6-16 8-22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M11 20c-2 0-4-2-3-4s4-1 4 2M13 14c-2-1-3-3-1-4s4 1 3 3M10 24c-3 1-5-1-4-3s4-1 4 2" stroke="currentColor" strokeWidth="1" /></svg>;
    /* ── Hypnos ── */
    case 'moon':
      return <svg {...svgProps}><path d="M20 6c-8 2-12 8-10 16s10 10 16 6c-4 0-10-4-10-12s2-8 4-10z" stroke="currentColor" strokeWidth="1.3" /></svg>;
    case 'cloud':
      return <svg {...svgProps}><path d="M8 20c-2-2-2-6 2-6 0-4 4-6 8-4 2-2 6-2 6 2 2 0 4 2 2 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 22h22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'zzz':
      return <svg {...svgProps}><path d="M10 8h8l-8 8h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M18 18h5l-5 5h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    /* ── Nemesis ── */
    case 'scales':
      return <svg {...svgProps}><path d="M16 4v22M8 10l16 0M8 10l-2 10h6zM24 10l2 10h-6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'eye':
      return <svg {...svgProps}><path d="M4 16c4-8 12-10 16-8s8 4 8 8-4 10-8 8-12 0-16-8z" stroke="currentColor" strokeWidth="1.2" /><circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="16" cy="16" r="1.5" fill="currentColor" /></svg>;
    /* ── Hecate ── */
    case 'torch':
      return <svg {...svgProps}><path d="M16 14v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 14h8" stroke="currentColor" strokeWidth="1.2" /><path d="M14 14c-1-4 0-8 2-10s3 6 2 10" stroke="currentColor" strokeWidth="1.2" /></svg>;
    case 'key':
      return <svg {...svgProps}><circle cx="16" cy="10" r="5" stroke="currentColor" strokeWidth="1.3" /><path d="M16 15v11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M16 22h4M16 26h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    /* ── Hera ── */
    case 'peacock':
      return <svg {...svgProps}><circle cx="16" cy="22" r="3" stroke="currentColor" strokeWidth="1.2" /><path d="M16 19V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M8 6c2 4 6 6 8 4M24 6c-2 4-6 6-8 4M4 10c4 4 8 4 12 2M28 10c-4 4-8 4-12 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'scepter':
      return <svg {...svgProps}><path d="M16 10v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="16" cy="8" r="4" stroke="currentColor" strokeWidth="1.3" /><path d="M12 28h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    /* ── Artemis ── */
    case 'bow':
      return <svg {...svgProps}><path d="M8 6c0 12 4 20 8 20s8-8 8-20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M8 6h16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'deer':
      return <svg {...svgProps}><path d="M12 28l4-10 4 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="14" r="4" stroke="currentColor" strokeWidth="1.2" /><path d="M12 10l-4-6M10 8l-4 0M20 10l4-6M22 8l4 0" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    /* ── Iris ── */
    case 'rainbow':
      return <svg {...svgProps}><path d="M4 24c0-12 6-18 12-18s12 6 12 18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M8 24c0-8 4-14 8-14s8 6 8 14" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /><path d="M12 24c0-6 2-10 4-10s4 4 4 10" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" /></svg>;
    case 'prism':
      return <svg {...svgProps}><path d="M16 4L6 28h20z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M16 12l6 14" stroke="currentColor" strokeWidth="0.8" /></svg>;
    /* ── Nike ── */
    case 'wreath':
      return <svg {...svgProps}><path d="M10 24c-4-4-6-10-4-14s6-4 10-2c4-2 8-2 10 2s0 10-4 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M16 26v-4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'trophy':
      return <svg {...svgProps}><path d="M11 6h10v8c0 3-2 5-5 5s-5-2-5-5z" stroke="currentColor" strokeWidth="1.3" /><path d="M11 8H7c0 4 2 6 4 6M21 8h4c0 4-2 6-4 6" stroke="currentColor" strokeWidth="1.1" /><path d="M16 19v4M12 23h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    /* ── Hebe ── */
    case 'goblet':
      return <svg {...svgProps}><path d="M10 6h12l-2 10c0 2-2 4-4 4s-4-2-4-4z" stroke="currentColor" strokeWidth="1.3" /><path d="M16 20v4M12 24h8M12 28h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    case 'youth':
      return <svg {...svgProps}><circle cx="16" cy="10" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M12 16c-2 4-2 8 0 10M20 16c2 4 2 8 0 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /><path d="M12 26h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    /* ── Tyche ── */
    case 'wheel':
      return <svg {...svgProps}><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.3" /><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1" /><path d="M16 6v7M16 19v7M6 16h7M19 16h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" /></svg>;
    case 'clover':
      return <svg {...svgProps}><circle cx="16" cy="10" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="10" cy="16" r="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="22" cy="16" r="4" stroke="currentColor" strokeWidth="1.2" /><path d="M16 20v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
    case 'dice':
      return <svg {...svgProps}><rect x="6" y="6" width="20" height="20" rx="3" stroke="currentColor" strokeWidth="1.3" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="20" cy="12" r="1.5" fill="currentColor" /><circle cx="16" cy="16" r="1.5" fill="currentColor" /><circle cx="12" cy="20" r="1.5" fill="currentColor" /><circle cx="20" cy="20" r="1.5" fill="currentColor" /></svg>;
    /* ── Persephone ── */
    case 'pomegranate':
      return <svg {...svgProps}><circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.3" /><path d="M14 7h4l-2 3z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /><circle cx="13" cy="14" r="1.5" fill="currentColor" /><circle cx="19" cy="14" r="1.5" fill="currentColor" /><circle cx="16" cy="19" r="1.5" fill="currentColor" /></svg>;
    /* ── fallback (eagle etc.) ── */
    default:
      return <svg {...svgProps}><path d="M16 4l3 8h8l-6 5 2 8-7-4-7 4 2-8-6-5h8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
  }
}

function CampMembers() {
  const [members, setMembers] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchAllCharacters()
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  /* stable per-card rotation + decoration + deity-based doodles (8–10) */
  const cardMeta = useMemo(() =>
    members.map((m) => {
      const h = hash(m.characterId);
      const deityKeys = parseDeityNames(m.dietyBlood);
      const isRosabella = m.nicknameEng.toLowerCase() === 'rosabella';

      /* pick doodle pool based on deity */
      let pool: DoodleType[];
      if (isRosabella) {
        // Special: heart + rose, then Persephone + Hades doodles
        const persephonePick = (DEITY_DOODLES.persephone || GENERIC_DOODLES).slice(0, 4);
        const hadesPick = (DEITY_DOODLES.hades || GENERIC_DOODLES).slice(0, 4);
        pool = ['heart' as DoodleType, 'rose' as DoodleType, ...persephonePick, ...hadesPick];
      } else {
        // Combine doodle sets from all deity parents
        const sets = deityKeys.map((k) => DEITY_DOODLES[k] || GENERIC_DOODLES);
        pool = sets.flat();
        // Pad with generic if pool is too small
        while (pool.length < 10) pool = [...pool, ...GENERIC_DOODLES];
      }

      // Pad pool with generics (avoiding duplicates) so we never cycle
      const count = 14 + (h % 3); // 14–16 doodles
      if (pool.length < count) {
        const extras = GENERIC_DOODLES.filter((g) => !pool.includes(g));
        pool = [...pool, ...extras];
      }

      const doodles: { type: DoodleType; pos: DoodlePos }[] = [];
      const usedPos = new Set<DoodlePos>();
      const usedTypes = new Set<DoodleType>();
      for (let d = 0; d < count && d < DOODLE_POSITIONS.length; d++) {
        const hd = hash(m.characterId + `d${d}`);
        // Pick type, skip duplicates when possible
        let type = pool[d % pool.length];
        if (usedTypes.has(type)) {
          const alt = pool.find((t, i) => i >= d && !usedTypes.has(t))
                   || pool.find((t) => !usedTypes.has(t));
          if (alt) type = alt;
        }
        usedTypes.add(type);
        // pick unique positions
        let pos = DOODLE_POSITIONS[hd % DOODLE_POSITIONS.length];
        if (usedPos.has(pos)) {
          pos = DOODLE_POSITIONS.find((p) => !usedPos.has(p)) || pos;
        }
        usedPos.add(pos);
        doodles.push({ type, pos });
      }
      return {
        rotation: ((h % 9) - 4) * 1.3,
        deco: DECOS[h % DECOS.length],
        doodles,
      };
    }), [members]);

  if (loading) {
    return (
      <div className="camp camp--loading">
        <div className="app-loader__ring" />
      </div>
    );
  }

  return (
    <div className="camp">
      {/* Header */}
      <div className="camp__header">
        <div className="camp__laurel" aria-hidden="true">
          <svg viewBox="0 0 120 40" fill="none" className="camp__laurel-svg">
            <path d="M20 36C14 30 6 22 8 14C10 8 16 6 20 10C18 4 22 0 28 2C34 4 34 12 28 14C36 10 42 14 40 22C38 28 30 30 28 24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M100 36C106 30 114 22 112 14C110 8 104 6 100 10C102 4 98 0 92 2C86 4 86 12 92 14C84 10 78 14 80 22C82 28 90 30 92 24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="camp__title">Camp Half-Blood</h2>
        <p className="camp__sub">{members.length} Demigod{members.length !== 1 ? 's' : ''} &middot; Arena of Halves</p>
        <div className="camp__divider" />
      </div>

      {/* Corkboard grid */}
      <div className="camp__board">
        <div className="camp__grid">
          {members.map((m, i) => {
            const deityKey = parseDeityNames(m.dietyBlood)[0];
            const { rotation, deco, doodles } = cardMeta[i];
            const isPin = deco === 'pin';
            const isMe = user?.characterId === m.characterId;

            return (
              <button
                key={m.characterId}
                className={`camp__card${isMe ? ' camp__card--me' : ''}`}
                onClick={() => navigate(`/character/${m.characterId}`)}
                style={{ '--card-rot': `${rotation}deg` } as React.CSSProperties}
              >
                {/* Pin or tape decoration */}
                {isPin
                  ? <Pin color={m.theme[0]} />
                  : <Tape side={deco.replace('tape-', '') as 'l' | 'r' | 'c'} color={m.theme[0]} />
                }

                {/* "ME" label for current user */}
                {isMe && <span className="camp__me" style={{ background: m.theme[0] }}>ME</span>}

                {/* Polaroid */}
                <div className="camp__polaroid">
                  <div className="camp__photo">
                    {m.image ? (
                      <img src={m.image} alt={m.nicknameEng} className="camp__img" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="camp__ph" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${m.theme[0]} 15%, #f0e8d8), color-mix(in srgb, ${m.theme[0]} 25%, #e0d8c8))`, color: m.theme[0] }}>{m.nicknameEng[0]?.toUpperCase() ?? '?'}</div>
                    )}
                  </div>
                  {/* Doodle overlays scattered around the photo */}
                  {m.image && doodles.map((d, di) => (
                    <Doodle key={di} type={d.type} pos={d.pos} />
                  ))}

                  {/* Bottom strip with info */}
                  <div className="camp__strip">
                    <div className="camp__text">
                      <span className="camp__nick">{m.nicknameEng}</span>
                      <span className="camp__name">{m.nameEng}</span>
                    </div>
                    <div className="camp__badge">
                      <span className="camp__deity-icon">
                        {DEITY_SVG[deityKey] || <span>&#x26A1;</span>}
                      </span>
                    </div>
                  </div>

                  {/* Deity label */}
                  <div className="camp__deity-label">
                    <span className="camp__deity">{m.characterId.toLowerCase() === 'rosabella' ? 'Persephone' : (m.dietyBlood || 'Unknown')}</span>
                    <span className="camp__cabin">{m.cabin ? `Cabin ${m.cabin}` : '???'}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CampMembers;
