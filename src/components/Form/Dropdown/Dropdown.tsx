import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import ChevronDown from '../../../icons/ChevronDown';
import '../Form.scss';
import './Dropdown.scss';

interface Option {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  searchable?: boolean;
}

const MENU_MAX_HEIGHT = 200;
const MENU_GAP = 0;

export default function Dropdown({ label, value, onChange, options, placeholder, disabled = false, required = false, className, searchable = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [dropUp, setDropUp] = useState(false);

  const selected = options.find(o => o.value === value);

  const filtered = searchable && search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const shouldDropUp = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;

    setDropUp(shouldDropUp);
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MENU_MAX_HEIGHT, shouldDropUp ? spaceAbove : spaceBelow),
      ...(shouldDropUp
        ? { bottom: window.innerHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    setSearch('');

    // Block page scroll while open
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    // Focus search input when opening
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition, searchable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(o => !o);
    }
  };

  const handleSelect = (opt: Option) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div className={clsx('form__field', className)}>
      {label && (
        <span className="form__label">
          {label}{required && <span className="form__required">*</span>}
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        className={`form__dropdown-trigger${open ? ' form__dropdown-trigger--open' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <span className={selected ? 'form__dropdown-value' : 'form__dropdown-placeholder'}>
          {selected ? selected.label : placeholder || 'Select'}
        </span>
        <ChevronDown className="form__dropdown-chevron" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className={clsx('form__dropdown-menu', dropUp && 'form__dropdown-menu--up')}
          style={menuStyle}
        >
          {searchable && (
            <div className="form__dropdown-search">
              <input
                ref={searchRef}
                className="form__dropdown-search-input"
                type="text"
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}
              />
            </div>
          )}
          <ul className="form__dropdown-list">
            {filtered.length > 0 ? (
              filtered.map(o => (
                <li
                  key={o.value}
                  className={`form__dropdown-item${o.value === value ? ' form__dropdown-item--active' : ''}`}
                  onClick={() => handleSelect(o)}
                >
                  {o.label}
                </li>
              ))
            ) : (
              <li className="form__dropdown-empty">No results</li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
