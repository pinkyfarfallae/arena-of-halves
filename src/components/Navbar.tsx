import { useCallback, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { THEME_LABELS, updateTheme } from '../data/characters';
import './Navbar.scss';

/* ── Theme Picker Panel ── */
const CSS_VAR_KEYS = [
  '--ci-primary', '--ci-dark', '--ci-light', '--ci-accent',
  '--ci-bg', '--ci-fg', '--ci-surface', '--ci-muted', '--ci-border',
  '--ci-primary-hover', '--ci-accent-soft', '--ci-surface-hover',
  '--ci-bg-alt', '--ci-shadow', '--ci-highlight',
  '--ci-overlay', '--ci-nav-icon', '--ci-overlay-text', '--ci-primary-dark', '--ci-accent-dark',
  '--ci-left-grad1', '--ci-left-grad2', '--ci-right-grad1', '--ci-right-grad2',
  '--ci-tag-color',
];

function ThemePicker({ colors, onClose, onSave }: {
  colors: string[];
  onClose: () => void;
  onSave: (colors: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>([...colors]);
  const [saving, setSaving] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = panelRef.current?.offsetHeight ?? 300;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = startY.current - e.clientY;
    const next = Math.max(120, Math.min(window.innerHeight * 0.9, startH.current + delta));
    setHeight(next);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Live preview: apply colors to .app element directly
  const applyPreview = (nextColors: string[]) => {
    const appEl = document.querySelector('.app') as HTMLElement | null;
    if (!appEl) return;
    nextColors.forEach((c, i) => {
      if (CSS_VAR_KEYS[i]) appEl.style.setProperty(CSS_VAR_KEYS[i], c);
    });
  };

  const handleChange = (index: number, value: string) => {
    const next = [...draft];
    next[index] = value;
    setDraft(next);
    applyPreview(next);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <div className="tp" ref={panelRef} style={height ? { height } : undefined}>
      <div
        className="tp__drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="tp__drag-bar" />
      </div>
      <div className="tp__header">
        <h3 className="tp__title">Theme Colors</h3>
        <button className="tp__close" onClick={onClose} data-tooltip="Close" data-tooltip-pos="left">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="tp__grid">
        {THEME_LABELS.map((label, i) => (
          <label key={i} className="tp__swatch">
            <input
              type="color"
              className="tp__input"
              value={draft[i] || '#000000'}
              onChange={(e) => handleChange(i, e.target.value)}
            />
            <span className="tp__color" style={{ background: draft[i] }} />
            <span className="tp__label">{label}</span>
            <span className="tp__hex">{draft[i]}</span>
          </label>
        ))}
      </div>
      <button className="tp__save" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Theme'}
      </button>
    </div>
  );
}

/* ── Navbar ── */
function Navbar() {
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const isViewingMember = location.pathname.startsWith('/character/');

  const close = () => setOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="topbar">
        <NavLink to="/" end className="topbar__home" onClick={close}>
          {user?.nicknameEng?.[0]?.toUpperCase() ?? '?'}
        </NavLink>
        <button className="topbar__toggle" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open
              ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {open && <div className="topbar-backdrop" onClick={close} />}
      <div className={`topbar-menu ${open ? 'topbar-menu--open' : ''}`}>
        {user?.characterId && (
          <NavLink to="/" end className={({ isActive }) => `topbar-menu__item ${isActive ? 'topbar-menu__item--active' : ''}`} onClick={close}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Character</span>
          </NavLink>
        )}
        <NavLink to="/camp" className={({ isActive }) => `topbar-menu__item ${isActive || isViewingMember ? 'topbar-menu__item--active' : ''}`} onClick={close}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Camp Members</span>
        </NavLink>
        <button className="topbar-menu__item" onClick={() => { setShowThemePicker(p => !p); close(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <circle cx="7" cy="5" r="2.5" fill="currentColor" opacity="0.8" />
            <circle cx="17" cy="5" r="2.5" fill="currentColor" opacity="0.6" />
            <circle cx="4" cy="12" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="20" cy="12" r="2.5" fill="currentColor" opacity="0.5" />
            <circle cx="7" cy="19" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="17" cy="19" r="2.5" fill="currentColor" opacity="0.4" />
          </svg>
          <span>Theme Colors</span>
        </button>
        <button className="topbar-menu__item topbar-menu__item--logout" onClick={() => { logout(); close(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Logout</span>
        </button>
      </div>

      {/* Desktop sidebar */}
      <nav className="sidebar">
        <NavLink to="/" end className="sidebar__avatar" data-tooltip="Character Info" data-tooltip-pos="right">
          {user?.nicknameEng?.[0]?.toUpperCase() ?? '?'}
        </NavLink>

        <div className="sidebar__divider" />

        {user?.characterId && (
          <NavLink to="/" end className={({ isActive }) => `sidebar__icon ${isActive ? 'sidebar__icon--active' : ''}`} data-tooltip="Character" data-tooltip-pos="right">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </NavLink>
        )}

        <NavLink to="/camp" className={({ isActive }) => `sidebar__icon ${isActive || isViewingMember ? 'sidebar__icon--active' : ''}`} data-tooltip="Camp Members" data-tooltip-pos="right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </NavLink>

        <div className="sidebar__spacer" />

        <button className={`sidebar__icon ${showThemePicker ? 'sidebar__icon--active' : ''}`} onClick={() => setShowThemePicker(p => !p)} data-tooltip="Theme Colors" data-tooltip-pos="right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <circle cx="7" cy="5" r="2.5" fill="currentColor" opacity="0.8" />
            <circle cx="17" cy="5" r="2.5" fill="currentColor" opacity="0.6" />
            <circle cx="4" cy="12" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="20" cy="12" r="2.5" fill="currentColor" opacity="0.5" />
            <circle cx="7" cy="19" r="2.5" fill="currentColor" opacity="0.9" />
            <circle cx="17" cy="19" r="2.5" fill="currentColor" opacity="0.4" />
          </svg>
        </button>

        <button className="sidebar__icon sidebar__icon--logout" onClick={logout} data-tooltip="Logout" data-tooltip-pos="right">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </nav>

      {/* Theme picker panel */}
      {user && showThemePicker && (
        <ThemePicker
          colors={[...user.theme]}
          onClose={() => setShowThemePicker(false)}
          onSave={async (newColors) => {
            await updateTheme(user.characterId, newColors);
            updateUser({ theme: newColors as typeof user.theme });
            localStorage.setItem('aoh_theme', JSON.stringify(newColors));
            setShowThemePicker(false);
          }}
        />
      )}
    </>
  );
}

export default Navbar;
