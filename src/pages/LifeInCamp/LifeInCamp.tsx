import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CAMP_LOCATIONS, CampLocation } from '../../data/campLocations';
import './LifeInCamp.scss';

/* ── Location Icons (watercolor style) ── */
function LocationIcon({ type }: { type: string }) {
  const props = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: '1', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'hill':
      return <svg {...props}>
        <path d="M4 27l10-18 6 10 4-6 4 14H4z" fill="currentColor" opacity="0.18" />
        <path d="M4 27l10-18 6 10 4-6 4 14H4z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="0.8" />
        <path d="M6 27l8-14 4 7 3-4 3 11" fill="currentColor" opacity="0.12" />
        <path d="M14 9v-4" strokeWidth="1.2" /><path d="M12 6.5h4" strokeWidth="1.2" />
        <circle cx="14" cy="4" r="1.5" fill="currentColor" opacity="0.6" />
        <path d="M2 27h28" strokeWidth="0.5" opacity="0.3" />
      </svg>;
    case 'big-house':
      return <svg {...props}>
        <path d="M5 16l11-10 11 10" fill="currentColor" opacity="0.1" />
        <rect x="8" y="16" width="16" height="10" rx="1" fill="currentColor" opacity="0.15" />
        <path d="M5 16l11-10 11 10" strokeWidth="1" />
        <rect x="8" y="16" width="16" height="10" rx="1" strokeWidth="0.8" />
        <rect x="13" y="20" width="6" height="6" fill="currentColor" opacity="0.2" strokeWidth="0.6" stroke="currentColor" />
        <rect x="10" y="18" width="3" height="3" fill="currentColor" opacity="0.25" strokeWidth="0.5" stroke="currentColor" />
        <rect x="19" y="18" width="3" height="3" fill="currentColor" opacity="0.25" strokeWidth="0.5" stroke="currentColor" />
      </svg>;
    case 'woods':
      return <svg {...props}>
        <path d="M7 26l3-8-1 1-2-5 3 2-2-6 5 9-1-2 3 9" fill="currentColor" opacity="0.2" />
        <path d="M19 26l3-6-1 1-2-5 3 2-1-5 4 8-1-2 2 7" fill="currentColor" opacity="0.15" />
        <path d="M10 26V18M10 18l-5 8M10 18l5 8M10 18l-4-6M10 18l4-6M10 12l-3-5M10 12l3-5" strokeWidth="0.8" />
        <path d="M22 26V20M22 20l-4 6M22 20l4 6M22 20l-3-5M22 20l3-5" strokeWidth="0.8" />
        <circle cx="8" cy="10" r="2" fill="currentColor" opacity="0.08" />
        <circle cx="23" cy="17" r="1.5" fill="currentColor" opacity="0.06" />
      </svg>;
    case 'lake':
      return <svg {...props}>
        <ellipse cx="16" cy="18" rx="12" ry="6" fill="currentColor" opacity="0.15" />
        <ellipse cx="16" cy="17" rx="9" ry="4" fill="currentColor" opacity="0.1" />
        <path d="M4 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0" strokeWidth="1" />
        <path d="M6 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0" strokeWidth="0.8" opacity="0.6" />
        <path d="M14 10l-2-4h4l-2 4zM14 10v3" strokeWidth="0.8" />
        <path d="M8 19c3-1 5-1 8 0" strokeWidth="0.5" opacity="0.3" />
      </svg>;
    case 'dining':
      return <svg {...props}>
        <path d="M6 12v10a2 2 0 002 2h16a2 2 0 002-2V12" fill="currentColor" opacity="0.12" />
        <path d="M4 12h24" strokeWidth="1.2" />
        <path d="M6 12v10a2 2 0 002 2h16a2 2 0 002-2V12" strokeWidth="0.8" />
        <path d="M8 8v4M16 6v6M24 8v4" strokeWidth="1" />
        <circle cx="16" cy="4" r="1.5" fill="currentColor" opacity="0.35" />
        <rect x="10" y="15" width="12" height="6" rx="1" fill="currentColor" opacity="0.08" />
      </svg>;
    case 'cabins':
      return <svg {...props}>
        <path d="M4 16l6-6 6 6" fill="currentColor" opacity="0.12" />
        <rect x="5" y="16" width="10" height="8" rx="1" fill="currentColor" opacity="0.15" />
        <path d="M18 14l5-5 5 5" fill="currentColor" opacity="0.1" />
        <rect x="19" y="14" width="8" height="10" rx="1" fill="currentColor" opacity="0.13" />
        <path d="M4 16l6-6 6 6" strokeWidth="0.8" /><rect x="5" y="16" width="10" height="8" rx="1" strokeWidth="0.7" />
        <path d="M18 14l5-5 5 5" strokeWidth="0.8" /><rect x="19" y="14" width="8" height="10" rx="1" strokeWidth="0.7" />
        <rect x="8" y="19" width="4" height="5" fill="currentColor" opacity="0.2" strokeWidth="0.5" stroke="currentColor" />
      </svg>;
    case 'arena':
      return <svg {...props}>
        <ellipse cx="16" cy="18" rx="12" ry="7" fill="currentColor" opacity="0.12" />
        <path d="M4 18V14c0-4 5.4-7 12-7s12 3 12 7v4" fill="currentColor" opacity="0.08" />
        <ellipse cx="16" cy="18" rx="12" ry="7" strokeWidth="1" />
        <path d="M4 18V14c0-4 5.4-7 12-7s12 3 12 7v4" strokeWidth="0.8" />
        <path d="M8 11v7M12 9v9M20 9v9M24 11v7" strokeWidth="0.7" opacity="0.5" />
      </svg>;
    case 'forge':
      return <svg {...props}>
        <rect x="10" y="18" width="12" height="6" fill="currentColor" opacity="0.15" />
        <path d="M13 6l3 5 3-5" fill="currentColor" opacity="0.2" />
        <path d="M6 24h20" strokeWidth="1" /><path d="M10 24v-6h12v6" strokeWidth="0.8" />
        <path d="M14 18v-4h4v4" strokeWidth="0.7" fill="currentColor" opacity="0.1" />
        <path d="M16 14v-3" strokeWidth="0.8" /><path d="M13 6l3 5 3-5" strokeWidth="0.8" />
        <circle cx="10" cy="8" r="2" fill="currentColor" opacity="0.15" />
        <circle cx="22" cy="10" r="1.5" fill="currentColor" opacity="0.12" />
        <circle cx="10" cy="8" r="1" fill="currentColor" opacity="0.3" />
      </svg>;
    case 'archery':
      return <svg {...props}>
        <circle cx="16" cy="16" r="10" fill="currentColor" opacity="0.06" />
        <circle cx="16" cy="16" r="6" fill="currentColor" opacity="0.1" />
        <circle cx="16" cy="16" r="2.5" fill="currentColor" opacity="0.35" />
        <circle cx="16" cy="16" r="10" strokeWidth="0.8" />
        <circle cx="16" cy="16" r="6" strokeWidth="0.7" />
        <path d="M26 6l-8 8M26 6h-5M26 6v5" strokeWidth="1" />
      </svg>;
    case 'amphitheater':
      return <svg {...props}>
        <path d="M6 20a14 8 0 0120 0v4H6z" fill="currentColor" opacity="0.1" />
        <path d="M8 17a11 6 0 0116 0" fill="currentColor" opacity="0.08" />
        <path d="M6 20a14 8 0 0120 0" strokeWidth="1" />
        <path d="M8 17a11 6 0 0116 0" strokeWidth="0.8" opacity="0.7" />
        <path d="M10 14a8 4 0 0112 0" strokeWidth="0.7" opacity="0.5" />
        <rect x="13" y="22" width="6" height="4" rx="1" fill="currentColor" opacity="0.2" strokeWidth="0.6" stroke="currentColor" />
      </svg>;
    case 'stables':
      return <svg {...props}>
        <path d="M4 12l12-6 12 6" fill="currentColor" opacity="0.1" />
        <rect x="4" y="12" width="24" height="14" rx="2" fill="currentColor" opacity="0.13" />
        <rect x="4" y="12" width="24" height="14" rx="2" strokeWidth="0.8" />
        <path d="M4 12l12-6 12 6" strokeWidth="1" />
        <rect x="12" y="18" width="8" height="8" fill="currentColor" opacity="0.18" strokeWidth="0.5" stroke="currentColor" />
        <path d="M16 18v-2" strokeWidth="0.8" />
      </svg>;
    case 'strawberry':
      return <svg {...props}>
        <path d="M16 8c-4 0-8 4-8 10s4 8 8 8 8-2 8-8-4-10-8-10z" fill="currentColor" opacity="0.25" />
        <path d="M16 10c-3 0-6 3-6 8s3 6 6 6 6-1.5 6-6-3-8-6-8z" fill="currentColor" opacity="0.12" />
        <path d="M16 8c-4 0-8 4-8 10s4 8 8 8 8-2 8-8-4-10-8-10z" strokeWidth="0.8" />
        <path d="M13 6c1-2 3-2 3-2s2 0 3 2" strokeWidth="1" />
        <path d="M12 14l4-2 4 2M12 18l4-2 4 2" strokeWidth="0.6" opacity="0.5" />
      </svg>;
    case 'climbing':
      return <svg {...props}>
        <rect x="8" y="4" width="16" height="24" rx="2" fill="currentColor" opacity="0.12" />
        <rect x="8" y="4" width="16" height="24" rx="2" strokeWidth="0.8" />
        <circle cx="12" cy="10" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="20" cy="14" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="14" cy="19" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="19" cy="24" r="2" fill="currentColor" opacity="0.3" />
        <path d="M6 28c2-1 3-3 4-3s2 2 4 2 2-2 4-2 2 3 4 3 3-1 4-2" className="life__lava-path" strokeWidth="1.2" />
      </svg>;
    case 'campfire':
      return <svg {...props}>
        <path d="M16 6c-2 4-6 6-6 12a6 6 0 0012 0c0-6-4-8-6-12z" fill="currentColor" opacity="0.2" />
        <path d="M16 10c-1.5 3-4.5 4.5-4.5 9a4.5 4.5 0 009 0c0-4.5-3-6-4.5-9z" fill="currentColor" opacity="0.15" />
        <path d="M16 6c-2 4-6 6-6 12a6 6 0 0012 0c0-6-4-8-6-12z" strokeWidth="0.8" />
        <path d="M16 12c-1 2-3 3-3 6a3 3 0 006 0c0-3-2-4-3-6z" fill="currentColor" opacity="0.3" strokeWidth="0.5" stroke="currentColor" />
        <path d="M10 26l-2 2M22 26l2 2M14 26v2M18 26v2" strokeWidth="0.8" opacity="0.4" />
      </svg>;
    case 'armory':
      return <svg {...props}>
        <path d="M16 4l8 4v8c0 6-4 10-8 12-4-2-8-6-8-12V8l8-4z" fill="currentColor" opacity="0.15" />
        <path d="M16 6l6 3v6c0 4.5-3 7.5-6 9-3-1.5-6-4.5-6-9V9l6-3z" fill="currentColor" opacity="0.1" />
        <path d="M16 4l8 4v8c0 6-4 10-8 12-4-2-8-6-8-12V8l8-4z" strokeWidth="0.8" />
        <path d="M12 14l3 3 5-6" strokeWidth="1.2" />
      </svg>;
    case 'fountain':
      return <svg {...props}>
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
      </svg>;
    case 'store':
      return <svg {...props}>
        <rect x="5" y="12" width="22" height="14" rx="2" fill="currentColor" opacity="0.13" />
        <rect x="5" y="12" width="22" height="14" rx="2" strokeWidth="0.8" />
        <path d="M5 12l2-6h18l2 6" fill="currentColor" opacity="0.1" />
        <path d="M5 12l2-6h18l2 6" strokeWidth="0.9" />
        <path d="M5 12c0 2 2 3 3.5 3s3.5-1 3.5-3" strokeWidth="0.7" />
        <path d="M12 12c0 2 2 3 3.5 3s3.5-1 3.5-3" strokeWidth="0.7" />
        <path d="M19 12c0 2 2 3 3.5 3s3.5-1 3.5-3" strokeWidth="0.7" />
        <rect x="13" y="19" width="6" height="7" fill="currentColor" opacity="0.18" strokeWidth="0.5" stroke="currentColor" />
      </svg>;
    default:
      return <svg {...props}><circle cx="16" cy="16" r="8" fill="currentColor" opacity="0.15" /><circle cx="16" cy="16" r="8" /><circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.3" /></svg>;
  }
}

/* ── Action Icons for card buttons ── */
function ActionIcon({ type }: { type: string }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'wish':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6.5" strokeWidth="1" /><path d="M12 7v0.5M12 16.5v0.5M7 12h0.5M16.5 12h0.5" strokeWidth="1.5" /><path d="M9.5 9l1 1.5M14.5 9l-1 1.5M9.5 15l1-1.5M14.5 15l-1-1.5" strokeWidth="1" opacity="0.6" /></svg>;
    case 'shop':
      return <svg {...p}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>;
    case 'basket':
      return <svg {...p}><path d="M5 11l2 9h10l2-9" /><path d="M3 11h18" /><path d="M8 11V7a4 4 0 018 0v4" /><path d="M9 15v3M12 15v3M15 15v3" strokeWidth="1.5" /></svg>;
    case 'craft':
      return <svg {...p}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94L6.73 20.18a2 2 0 01-2.83 0l-.08-.08a2 2 0 010-2.83l6.7-6.7A6 6 0 0114.7 6.3z" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8l4 4-4 4M8 12h8" /></svg>;
  }
}

/* ── Location Pin + Card ── */
function LocationPin({ location, dimmed }: { location: CampLocation; dimmed?: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (pinRef.current && !pinRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const edge = [
    location.y < 15 ? 'life__pin--below' : '',
    location.x > 75 ? 'life__pin--left' : '',
    location.x < 15 ? 'life__pin--right' : '',
    location.y > 70 ? 'life__pin--above' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={pinRef}
      className={`life__pin life__pin--${location.size || 'md'} ${edge} ${dimmed ? 'life__pin--dimmed' : ''}`}
      style={{ left: `${location.x}%`, top: `${location.y}%`, '--pin-color': location.color } as React.CSSProperties}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="life__marker" onClick={() => {
        if (location.actionPaths?.[0]) {
          navigate(location.actionPaths[0]);
        } else {
          setOpen(o => !o);
        }
      }}>
        <LocationIcon type={location.icon} />
      </button>
      <span className="life__pin-label">{location.name}</span>
      <div className={`life__card ${open ? 'life__card--open' : ''}`}>
        {/* Card header */}
        <div className="life__card-header">
          <span className="life__card-icon">
            <LocationIcon type={location.icon} />
          </span>
          <span className="life__card-name">{location.name}</span>
        </div>

        {/* Card body */}
        <div className="life__card-body">
          <p className="life__card-desc">{location.description}</p>
          {location.tags && (
            <div className="life__card-tags">
              {location.tags.map(tag => (
                <span key={tag} className="life__tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {location.actionLabels?.map((label, i) => (
            <button
              key={label}
              className="life__card-action"
              onClick={() => location.actionPaths?.[i] && navigate(location.actionPaths[i])}
            >
              <ActionIcon type={location.actionIcons?.[i] || 'default'} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Map Decorations ── */
function MapDecorations() {
  return (
    <>
      {/* Map title */}
      <div className="life__map-title">
        <span className="life__map-title-text">Camp Half-Blood</span>
        <span className="life__map-title-sub">Long Island Sound, New York</span>
      </div>

      {/* Compass rose */}
      <div className="life__compass">
        <svg viewBox="0 0 100 100" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Outer decorative ring */}
          <circle cx="50" cy="50" r="46" stroke="#8B7355" strokeWidth="1.5" opacity="0.3" />
          <circle cx="50" cy="50" r="43" stroke="#8B7355" strokeWidth="0.5" opacity="0.2" />
          {/* Degree tick marks */}
          {Array.from({ length: 32 }).map((_, i) => {
            const angle = (i * 360) / 32 - 90;
            const rad = (angle * Math.PI) / 180;
            const major = i % 8 === 0;
            const minor = i % 4 === 0;
            const r1 = major ? 38 : minor ? 40 : 41.5;
            const r2 = 43;
            return (
              <line
                key={`tick-${i}`}
                x1={50 + r1 * Math.cos(rad)} y1={50 + r1 * Math.sin(rad)}
                x2={50 + r2 * Math.cos(rad)} y2={50 + r2 * Math.sin(rad)}
                stroke="#8B7355" strokeWidth={major ? 1.2 : 0.6} opacity={major ? 0.5 : minor ? 0.3 : 0.15}
              />
            );
          })}
          {/* Inner ring */}
          <circle cx="50" cy="50" r="36" stroke="#8B7355" strokeWidth="0.8" opacity="0.2" />
          {/* Main star — N/S cardinal points (tall) */}
          <polygon points="50,12 53,44 50,50 47,44" fill="#C4463A" opacity="0.85" />
          <polygon points="50,88 47,56 50,50 53,56" fill="#8B7355" opacity="0.35" />
          {/* Main star — E/W cardinal points (tall) */}
          <polygon points="88,50 56,47 50,50 56,53" fill="#8B7355" opacity="0.35" />
          <polygon points="12,50 44,53 50,50 44,47" fill="#8B7355" opacity="0.35" />
          {/* Intercardinal points (shorter) */}
          <polygon points="76,24 55,45 50,50 45,55" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
          <polygon points="24,24 45,45 50,50 55,55" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
          <polygon points="76,76 55,55 50,50 45,45" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
          <polygon points="24,76 45,55 50,50 55,45" fill="#8B7355" opacity="0.15" stroke="#8B7355" strokeWidth="0.5" />
          {/* Star outlines */}
          <path d="M50 12L53 44 50 50 47 44Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.6" />
          <path d="M50 88L47 56 50 50 53 56Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.4" />
          <path d="M88 50L56 47 50 50 56 53Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.4" />
          <path d="M12 50L44 53 50 50 44 47Z" stroke="#8B7355" strokeWidth="0.8" opacity="0.4" />
          {/* Center circle */}
          <circle cx="50" cy="50" r="4" fill="#8B7355" opacity="0.25" />
          <circle cx="50" cy="50" r="2" fill="#C4463A" opacity="0.6" />
          {/* Cardinal labels */}
          <text x="50" y="9" textAnchor="middle" fontSize="8" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#C4463A" opacity="0.9">N</text>
          <text x="50" y="98" textAnchor="middle" fontSize="6.5" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#8B7355" opacity="0.45">S</text>
          <text x="96" y="53" textAnchor="middle" fontSize="6.5" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#8B7355" opacity="0.45">E</text>
          <text x="4" y="53" textAnchor="middle" fontSize="6.5" fontFamily="Cinzel Decorative, serif" fontWeight="700" fill="#8B7355" opacity="0.45">W</text>
        </svg>
      </div>

      {/* Trail paths */}
      <svg className="life__trails" viewBox="0 0 1000 625" preserveAspectRatio="none">
        {/* Hill → Big House */}
        <path d="M500 81 C480 110, 460 145, 450 175" />
        {/* Big House → Iris Fountain */}
        <path d="M450 175 C410 195, 350 220, 300 250" />
        {/* Iris Fountain → Woods */}
        <path d="M300 250 C260 240, 220 220, 180 200" />
        {/* Big House → Camp Store */}
        <path d="M450 175 C520 160, 600 140, 700 125" />
        {/* Big House → Dining */}
        <path d="M450 175 C480 200, 520 230, 550 263" />
        {/* Dining → Cabins */}
        <path d="M550 263 C510 285, 450 310, 400 338" />
        {/* Dining → Arena */}
        <path d="M550 263 C620 275, 680 290, 750 313" />
        {/* Arena → Forge */}
        <path d="M750 313 C780 280, 810 250, 850 213" />
        {/* Arena → Armory */}
        <path d="M750 313 C800 325, 860 340, 900 363" />
        {/* Arena → Archery */}
        <path d="M750 313 C730 350, 710 390, 680 425" />
        {/* Archery → Climbing Wall */}
        <path d="M680 425 C720 430, 770 440, 820 450" />
        {/* Cabins → Amphitheater */}
        <path d="M400 338 C390 370, 370 420, 350 469" />
        {/* Amphitheater → Campfire */}
        <path d="M350 469 C400 490, 460 520, 520 550" />
        {/* Amphitheater → Stables */}
        <path d="M350 469 C310 460, 270 450, 220 438" />
        {/* Stables → Canoe Lake */}
        <path d="M220 438 C185 410, 150 380, 120 344" />
        {/* Stables → Strawberry Fields */}
        <path d="M220 438 C175 465, 130 500, 80 531" />
      </svg>

      {/* Lake area */}
      <svg className="life__lake-shape" viewBox="0 0 200 120">
        <ellipse cx="100" cy="60" rx="80" ry="50" />
        <path d="M30 55c10-5 20-5 30 0s20 5 30 0 20-5 30 0 20 5 30 0" className="life__lake-wave" />
        <path d="M40 70c10-4 18-4 28 0s18 4 28 0 18-4 28 0" className="life__lake-wave" />
      </svg>

      {/* Forest area */}
      <div className="life__forest-area">
        {Array.from({ length: 8 }).map((_, i) => (
          <svg key={i} className="life__tree" viewBox="0 0 20 28" style={{ left: `${10 + (i % 4) * 22}%`, top: `${10 + Math.floor(i / 4) * 35}%` }}>
            <path d="M10 4l-6 10h12L10 4z" fill="currentColor" opacity="0.12" />
            <path d="M10 8l-5 8h10L10 8z" fill="currentColor" opacity="0.08" />
            <path d="M10 16v8" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
          </svg>
        ))}
      </div>

      {/* Scattered decorations */}
      <div className="life__decorations">
        {/* Bushes */}
        {[
          { x: 60, y: 18, s: 1 }, { x: 92, y: 15, s: 0.8 }, { x: 5, y: 35, s: 0.9 },
          { x: 48, y: 62, s: 1.1 }, { x: 75, y: 82, s: 0.7 }, { x: 28, y: 85, s: 0.9 },
          { x: 93, y: 72, s: 0.8 }, { x: 62, y: 8, s: 0.7 }, { x: 3, y: 68, s: 1 },
          { x: 85, y: 88, s: 0.8 }, { x: 45, y: 92, s: 0.9 },
        ].map((b, i) => (
          <svg key={`bush-${i}`} className="life__deco life__deco--bush" viewBox="0 0 24 16" style={{ left: `${b.x}%`, top: `${b.y}%`, transform: `scale(${b.s})` }}>
            <ellipse cx="12" cy="10" rx="10" ry="6" fill="#4caf50" opacity="0.2" />
            <ellipse cx="8" cy="9" rx="6" ry="5" fill="#66bb6a" opacity="0.15" />
            <ellipse cx="16" cy="9" rx="6" ry="5" fill="#43a047" opacity="0.15" />
          </svg>
        ))}

        {/* Rocks */}
        {[
          { x: 70, y: 30, s: 1 }, { x: 30, y: 55, s: 0.8 }, { x: 88, y: 42, s: 0.7 },
          { x: 55, y: 72, s: 0.9 }, { x: 15, y: 90, s: 0.8 }, { x: 42, y: 18, s: 0.7 },
          { x: 78, y: 58, s: 0.9 }, { x: 95, y: 30, s: 0.6 },
        ].map((r, i) => (
          <svg key={`rock-${i}`} className="life__deco life__deco--rock" viewBox="0 0 20 14" style={{ left: `${r.x}%`, top: `${r.y}%`, transform: `scale(${r.s})` }}>
            <path d="M3 12l2-6 4-3 5 1 3 4 1 4z" fill="#9e9e9e" opacity="0.18" />
            <path d="M5 11l1-4 3-2 3 0.5 2 3z" fill="#bdbdbd" opacity="0.12" />
          </svg>
        ))}

        {/* Flowers */}
        {[
          { x: 25, y: 48, c: '#e91e63' }, { x: 58, y: 28, c: '#ff9800' }, { x: 44, y: 82, c: '#9c27b0' },
          { x: 76, y: 18, c: '#f44336' }, { x: 15, y: 72, c: '#ff5722' }, { x: 68, y: 52, c: '#e91e63' },
          { x: 90, y: 82, c: '#ff9800' }, { x: 35, y: 12, c: '#9c27b0' }, { x: 8, y: 50, c: '#f44336' },
          { x: 52, y: 48, c: '#ff5722' },
        ].map((f, i) => (
          <svg key={`flower-${i}`} className="life__deco life__deco--flower" viewBox="0 0 12 12" style={{ left: `${f.x}%`, top: `${f.y}%` }}>
            <circle cx="6" cy="4" r="2" fill={f.c} opacity="0.25" />
            <circle cx="4" cy="6" r="2" fill={f.c} opacity="0.2" />
            <circle cx="8" cy="6" r="2" fill={f.c} opacity="0.2" />
            <circle cx="6" cy="6" r="1.2" fill="#fdd835" opacity="0.3" />
            <path d="M6 8v3" stroke="#66bb6a" strokeWidth="0.8" opacity="0.3" />
          </svg>
        ))}

        {/* Grass tufts */}
        {[
          { x: 33, y: 30 }, { x: 65, y: 42 }, { x: 82, y: 52 }, { x: 20, y: 18 },
          { x: 50, y: 55 }, { x: 10, y: 82 }, { x: 72, y: 72 }, { x: 40, y: 40 },
          { x: 88, y: 20 }, { x: 55, y: 88 }, { x: 30, y: 65 }, { x: 95, y: 60 },
          { x: 5, y: 25 }, { x: 62, y: 32 },
        ].map((g, i) => (
          <svg key={`grass-${i}`} className="life__deco life__deco--grass" viewBox="0 0 16 12" style={{ left: `${g.x}%`, top: `${g.y}%` }}>
            <path d="M4 11c0-4 1-7 2-9" stroke="#66bb6a" strokeWidth="0.8" fill="none" opacity="0.25" />
            <path d="M8 11c0-3 0-6 0-8" stroke="#4caf50" strokeWidth="0.8" fill="none" opacity="0.3" />
            <path d="M12 11c0-4-1-6-2-8" stroke="#81c784" strokeWidth="0.8" fill="none" opacity="0.2" />
          </svg>
        ))}

        {/* Flags / banners */}
        {[
          { x: 60, y: 38, c: '#f44336' }, { x: 46, y: 70, c: '#2196f3' },
          { x: 78, y: 35, c: '#ff9800' }, { x: 25, y: 52, c: '#4caf50' },
        ].map((fl, i) => (
          <svg key={`flag-${i}`} className="life__deco life__deco--flag" viewBox="0 0 12 20" style={{ left: `${fl.x}%`, top: `${fl.y}%` }}>
            <path d="M3 2v16" stroke="#795548" strokeWidth="0.8" opacity="0.3" />
            <path d="M3 2l7 3-7 3z" fill={fl.c} opacity="0.22" />
          </svg>
        ))}

        {/* Birds */}
        {[
          { x: 38, y: 8 }, { x: 72, y: 12 }, { x: 55, y: 5 },
          { x: 85, y: 10 }, { x: 18, y: 6 },
        ].map((bd, i) => (
          <svg key={`bird-${i}`} className="life__deco life__deco--bird" viewBox="0 0 16 8" style={{ left: `${bd.x}%`, top: `${bd.y}%` }}>
            <path d="M1 6c2-3 4-4 7-2 3-2 5-1 7 2" stroke="#5d4037" strokeWidth="0.8" fill="none" opacity="0.2" />
          </svg>
        ))}

        {/* Mushrooms */}
        {[
          { x: 7, y: 28, c: '#e53935' }, { x: 24, y: 42, c: '#8e24aa' },
          { x: 58, y: 65, c: '#e53935' }, { x: 42, y: 22, c: '#ff8f00' },
          { x: 76, y: 78, c: '#8e24aa' }, { x: 92, y: 38, c: '#e53935' },
        ].map((m, i) => (
          <svg key={`mush-${i}`} className="life__deco life__deco--mushroom" viewBox="0 0 14 16" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
            <ellipse cx="7" cy="8" rx="6" ry="4.5" fill={m.c} opacity="0.22" />
            <rect x="5.5" y="8" width="3" height="6" rx="1" fill="#795548" opacity="0.2" />
            <circle cx="5" cy="7" r="1" fill="white" opacity="0.2" />
            <circle cx="8.5" cy="6.5" r="0.7" fill="white" opacity="0.15" />
          </svg>
        ))}

        {/* Stepping stones */}
        {[
          { x: 47, y: 35 }, { x: 63, y: 55 }, { x: 32, y: 58 },
          { x: 82, y: 48 }, { x: 18, y: 80 },
        ].map((s, i) => (
          <svg key={`stone-${i}`} className="life__deco life__deco--stone" viewBox="0 0 20 8" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <ellipse cx="5" cy="4" rx="4" ry="2.5" fill="#9e9e9e" opacity="0.14" />
            <ellipse cx="13" cy="4.5" rx="5" ry="2.8" fill="#8d6e63" opacity="0.12" />
          </svg>
        ))}

        {/* Butterflies */}
        {[
          { x: 42, y: 15, c: '#e91e63' }, { x: 68, y: 25, c: '#ff9800' },
          { x: 22, y: 55, c: '#2196f3' }, { x: 85, y: 58, c: '#9c27b0' },
          { x: 50, y: 75, c: '#ff5722' }, { x: 12, y: 38, c: '#4caf50' },
        ].map((bf, i) => (
          <svg key={`bfly-${i}`} className="life__deco life__deco--butterfly" viewBox="0 0 16 12" style={{ left: `${bf.x}%`, top: `${bf.y}%` }}>
            <path d="M8 6c-2-4-6-4-6-1s4 4 6 1" fill={bf.c} opacity="0.2" />
            <path d="M8 6c2-4 6-4 6-1s-4 4-6 1" fill={bf.c} opacity="0.18" />
            <path d="M8 3v6" stroke="#5d4037" strokeWidth="0.4" opacity="0.2" />
          </svg>
        ))}

        {/* Torches */}
        {[
          { x: 56, y: 30 }, { x: 38, y: 60 }, { x: 74, y: 40 },
          { x: 20, y: 68 }, { x: 88, y: 68 },
        ].map((t, i) => (
          <svg key={`torch-${i}`} className="life__deco life__deco--torch" viewBox="0 0 8 20" style={{ left: `${t.x}%`, top: `${t.y}%` }}>
            <rect x="3" y="8" width="2" height="10" rx="0.5" fill="#795548" opacity="0.2" />
            <path d="M4 3c-1 2-2 3-2 5a2 2 0 004 0c0-2-1-3-2-5z" fill="#ff9800" opacity="0.25" />
            <path d="M4 5c-0.5 1-1 1.5-1 2.5a1 1 0 002 0c0-1-0.5-1.5-1-2.5z" fill="#ffeb3b" opacity="0.2" />
          </svg>
        ))}
      </div>
    </>
  );
}

/* ── Main Page ── */
function LifeInCamp() {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const q = search.toLowerCase();

  useEffect(() => {
    if (!q || !scrollRef.current) return;
    const match = CAMP_LOCATIONS.find(loc => loc.name.toLowerCase().startsWith(q));
    if (!match) return;
    const container = scrollRef.current;
    const map = container.querySelector('.life__map') as HTMLElement;
    if (!map) return;
    const targetX = (match.x / 100) * map.scrollWidth - container.clientWidth / 2;
    const targetY = (match.y / 100) * map.scrollHeight - container.clientHeight / 2;
    container.scrollTo({ left: Math.max(0, targetX), top: Math.max(0, targetY), behavior: 'smooth' });
  }, [q]);

  return (
    <div className="life" ref={scrollRef}>
      <div className="life__map">
        <div
          className={`life__search-box ${search ? 'life__search-box--active' : ''}`}
          onClick={() => searchRef.current?.focus()}
        >
          <svg className="life__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={searchRef}
            className="life__search"
            type="text"
            placeholder="Search locations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="life__search-clear" onClick={() => setSearch('')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <MapDecorations />
        {CAMP_LOCATIONS.map(loc => {
          const match = !q || loc.name.toLowerCase().startsWith(q);
          return (
            <LocationPin key={loc.id} location={loc} dimmed={!match} />
          );
        })}
      </div>
    </div>
  );
}

export default LifeInCamp;
