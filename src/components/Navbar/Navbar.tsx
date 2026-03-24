import { useCallback, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { updateTheme } from '../../data/characters';
import { THEME_LABELS, CSS_VAR_KEYS, DEITY_THEMES, DEFAULT_THEME } from '../../constants/theme';
import CloseIcon from '../../icons/Close';
import MenuToggle from './icons/MenuToggle';
import Person from './icons/Person';
import People from './icons/People';
import MapIcon from './icons/MapIcon';
import Palette from './icons/Palette';
import Shield from './icons/Shield';
import Settings from './icons/Settings';
import Logout from './icons/Logout';
import Undo from './icons/Undo';
import Reset from './icons/Reset';
import { ROLE } from '../../constants/role';
import SettingsModal from '../SettingsModal/SettingsModal';
import './Navbar.scss';

/* ── Theme Picker Panel ── */
function ThemePicker({ colors, deityBlood, onClose, onSave }: {
  colors: string[];
  deityBlood?: string;
  onClose: () => void;
  onSave: (colors: string[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string[]>([...colors]);
  const [saving, setSaving] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const deityTheme = deityBlood
    ? (DEITY_THEMES[deityBlood.toLowerCase().trim()] || DEFAULT_THEME)
    : DEFAULT_THEME;

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

  const handleUndo = (index: number) => {
    const next = [...draft];
    next[index] = colors[index];
    setDraft(next);
    applyPreview(next);
  };

  const handleUndoAll = () => {
    setDraft([...colors]);
    applyPreview(colors);
  };

  const handleReset = () => {
    setDraft([...deityTheme]);
    applyPreview(deityTheme);
  };

  const handleClose = () => {
    applyPreview(colors);
    onClose();
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
        <h3 className="tp__title">{t('THEME_COLORS')}</h3>
        <div className="tp__header-actions">
          <button className="tp__reset" onClick={handleUndoAll} data-tooltip={t('UNDO_ALL_CHANGES')} data-tooltip-pos="bottom">
            <Undo width={14} height={14} />
            {t('UNDO_ALL')}
          </button>
          <button className="tp__reset" onClick={handleReset} data-tooltip={t('RESET_TO_DEITY_THEME')} data-tooltip-pos="bottom">
            <Reset width={14} height={14} />
            {t('RESET')}
          </button>
          <button className="tp__close" onClick={handleClose} data-tooltip={t('CLOSE')} data-tooltip-pos="left">
            <CloseIcon width="16" height="16" />
          </button>
        </div>
      </div>
      <div className="tp__grid">
        {THEME_LABELS.map((label: string, i: number) => {
          const modified = draft[i] !== colors[i];
          return (
            <label key={i} className={`tp__swatch ${modified ? 'tp__swatch--modified' : ''}`}>
              <input
                type="color"
                className="tp__input"
                value={draft[i] || '#000000'}
                onChange={(e) => handleChange(i, e.target.value)}
              />
              <span className="tp__color" style={{ background: draft[i] }} />
              <span className="tp__label">{label}</span>
              <span className="tp__hex">{draft[i]}</span>
              {modified && (
                <button
                  type="button"
                  className="tp__undo"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUndo(i); }}
                  data-tooltip={t('UNDO')} data-tooltip-pos="top"
                >
                  <Undo width={10} height={10} />
                </button>
              )}
            </label>
          );
        })}
      </div>
      <button className="tp__save" onClick={handleSave} disabled={saving}>
        {saving ? t('SAVING') : t('SAVE_THEME')}
      </button>
    </div>
  );
}

/* ── Navbar ── */
function Navbar() {
  const { user, role, logout, updateUser } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isViewingMember = location.pathname.startsWith('/character/');
  const isLifeSubPage = location.pathname === '/iris-message' || location.pathname === '/shop' || location.pathname === '/craft-forge' || location.pathname === '/strawberry-fields';
  const isAdmin = role === ROLE.ADMIN || role === ROLE.DEVELOPER;

  const close = () => setOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="topbar">
        <NavLink to="/" end className="topbar__home" onClick={close}>
          {user?.nicknameEng?.[0]?.toUpperCase() ?? '?'}
        </NavLink>
        <button className="topbar__toggle" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
          <MenuToggle open={open} />
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {open && <div className="topbar-backdrop" onClick={close} />}
      <div className={`topbar-menu ${open ? 'topbar-menu--open' : ''}`}>
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `topbar-menu__item topbar-menu__item--admin ${isActive ? 'topbar-menu__item--active' : ''}`} onClick={close}>
            <Shield />
            <span>{t('ADMIN_MANAGER')}</span>
          </NavLink>
        )}
        {user?.characterId && (
          <NavLink to="/" end className={({ isActive }) => `topbar-menu__item ${isActive ? 'topbar-menu__item--active' : ''}`} onClick={close}>
            <Person />
            <span>{t('CHARACTER')}</span>
          </NavLink>
        )}
        <NavLink to="/camp" className={({ isActive }) => `topbar-menu__item ${isActive || isViewingMember ? 'topbar-menu__item--active' : ''}`} onClick={close}>
          <People />
          <span>{t('CAMP_MEMBERS')}</span>
        </NavLink>
        <NavLink to="/life" className={({ isActive }) => `topbar-menu__item ${isActive || isLifeSubPage ? 'topbar-menu__item--active' : ''}`} onClick={close}>
          <MapIcon />
          <span>{t('LIFE_IN_CAMP')}</span>
        </NavLink>
        <button className="topbar-menu__item" onClick={() => { setShowThemePicker(p => !p); close(); }}>
          <Palette />
          <span>{t('THEME_COLORS')}</span>
        </button>
        <button className="topbar-menu__item" onClick={() => { setShowSettings(p => !p); close(); }}>
          <Settings />
          <span>{t('SETTINGS')}</span>
        </button>
        <button className="topbar-menu__item topbar-menu__item--logout" onClick={() => { logout(); close(); }}>
          <Logout />
          <span>{t('LOGOUT')}</span>
        </button>
      </div>

      {/* Desktop sidebar */}
      <nav className="sidebar">
        <NavLink to="/" end className="sidebar__avatar" data-tooltip={t('CHARACTER_INFO')} data-tooltip-pos="right">
          {user?.nicknameEng?.[0]?.toUpperCase() ?? '?'}
        </NavLink>

        <div className="sidebar__divider" />

        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `sidebar__icon sidebar__icon--admin ${isActive ? 'sidebar__icon--active' : ''}`} data-tooltip={t('ADMIN_MANAGER')} data-tooltip-pos="right">
            <Shield />
          </NavLink>
        )}

        {user?.characterId && (
          <NavLink to="/" end className={({ isActive }) => `sidebar__icon ${isActive ? 'sidebar__icon--active' : ''}`} data-tooltip={t('CHARACTER')} data-tooltip-pos="right">
            <Person />
          </NavLink>
        )}

        <NavLink to="/camp" className={({ isActive }) => `sidebar__icon ${isActive || isViewingMember ? 'sidebar__icon--active' : ''}`} data-tooltip={t('CAMP_MEMBERS')} data-tooltip-pos="right">
          <People />
        </NavLink>

        <NavLink to="/life" className={({ isActive }) => `sidebar__icon ${isActive || isLifeSubPage ? 'sidebar__icon--active' : ''}`} data-tooltip={t('LIFE_IN_CAMP')} data-tooltip-pos="right">
          <MapIcon />
        </NavLink>

        <div className="sidebar__spacer" />

        <button className={`sidebar__icon ${showThemePicker ? 'sidebar__icon--active' : ''}`} onClick={() => setShowThemePicker(p => !p)} data-tooltip={t('THEME_COLORS')} data-tooltip-pos="right">
          <Palette strokeWidth="1.5" />
        </button>

        <button className={`sidebar__icon ${showSettings ? 'sidebar__icon--active' : ''}`} onClick={() => setShowSettings(p => !p)} data-tooltip={t('SETTINGS')} data-tooltip-pos="right">
          <Settings strokeWidth="1.5" />
        </button>

        <button className="sidebar__icon sidebar__icon--logout" onClick={logout} data-tooltip={t('LOGOUT')} data-tooltip-pos="right">
          <Logout />
        </button>
      </nav>

      {/* Theme picker panel */}
      {user && showThemePicker && (
        <ThemePicker
          colors={[...user.theme]}
          deityBlood={user.deityBlood}
          onClose={() => setShowThemePicker(false)}
          onSave={async (newColors) => {
            await updateTheme(user.characterId, newColors);
            updateUser({ theme: newColors as typeof user.theme });
            localStorage.setItem('aoh_theme', JSON.stringify(newColors));
            setShowThemePicker(false);
          }}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}

export default Navbar;
