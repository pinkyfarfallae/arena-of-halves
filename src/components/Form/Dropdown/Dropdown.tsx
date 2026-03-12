import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import ChevronDown from '../../../icons/ChevronDown';
import '../Form.scss';
import './Dropdown.scss';

interface Option {
  value: string;
  label: string;
}

/** Group of options with a section label */
export interface OptionGroup {
  label: string;
  options: Option[];
}

interface PropsSingle {
  multiSelect?: false;
  value: string;
  onChange: (value: string) => void;
}

interface PropsMulti {
  multiSelect: true;
  value: string[];
  onChange: (value: string[]) => void;
}

interface PropsCommon {
  label?: string;
  /** Flat list of options, or array of groups (each with label + options) */
  options: Option[] | OptionGroup[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  searchable?: boolean;
}

type Props = (PropsSingle | PropsMulti) & PropsCommon;

function flattenOptions(options: Option[] | OptionGroup[]): Option[] {
  if (options.length === 0) return [];
  const first = options[0];
  if ('options' in first && Array.isArray(first.options)) {
    return (options as OptionGroup[]).flatMap(g => g.options);
  }
  return options as Option[];
}

function isGrouped(options: Option[] | OptionGroup[]): options is OptionGroup[] {
  if (options.length === 0) return false;
  const first = options[0];
  return 'options' in first && Array.isArray((first as OptionGroup).options);
}

const MENU_MAX_HEIGHT = 200;
const MENU_GAP = 0;

export default function Dropdown({ label, value, onChange, options, placeholder, disabled = false, required = false, className, searchable = false, multiSelect = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [dropUp, setDropUp] = useState(false);

  const flatOptions = flattenOptions(options);
  const selectedValues = multiSelect ? (value as string[]) : [value as string].filter(Boolean);
  const selectedOptions = flatOptions.filter(o => selectedValues.includes(o.value));
  const selected = !multiSelect ? selectedOptions[0] : null;

  const grouped = isGrouped(options) ? options as OptionGroup[] : null;
  const filteredFlat = searchable && search
    ? flatOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : flatOptions;
  const filteredGroups = grouped && (searchable && search)
    ? grouped
        .map(g => ({ label: g.label, options: g.options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) }))
        .filter(g => g.options.length > 0)
    : grouped;

  const triggerLabel = multiSelect
    ? (selectedOptions.length === 0
        ? (placeholder || 'Select')
        : selectedOptions.length === 1
          ? selectedOptions[0].label
          : `${selectedOptions.length} selected`)
    : (selected ? selected.label : placeholder || 'Select');

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const el = triggerRef.current;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const shouldDropUp = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;

    const s = getComputedStyle(el);
    const themeVars: Record<string, string> = {};
    const ciVars = ['--ci-border', '--ci-muted', '--ci-primary', '--ci-primary-hover', '--ci-bg', '--ci-fg', '--ci-surface-hover', '--ci-light'] as const;
    ciVars.forEach(name => {
      const val = s.getPropertyValue(name).trim();
      if (val) themeVars[name] = val;
    });

    setDropUp(shouldDropUp);
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MENU_MAX_HEIGHT, shouldDropUp ? spaceAbove : spaceBelow),
      ...(shouldDropUp
        ? { bottom: window.innerHeight - rect.top + MENU_GAP }
        : { top: rect.bottom + MENU_GAP }),
      ...themeVars,
    } as React.CSSProperties);
  }, []);

  // Run position/size calculation before paint so the menu doesn't jitter (full screen then snap)
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    setSearch('');
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    // Block page scroll while open
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    // Focus search input when opening
    let focusTimer: number | undefined;
    if (searchable) {
      focusTimer = requestAnimationFrame(() => searchRef.current?.focus());
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
      if (focusTimer !== undefined) cancelAnimationFrame(focusTimer);
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
    if (multiSelect) {
      const current = value as string[];
      const next = current.includes(opt.value)
        ? current.filter(v => v !== opt.value)
        : [...current, opt.value];
      (onChange as (value: string[]) => void)(next);
    } else {
      (onChange as (value: string) => void)(opt.value);
      setOpen(false);
    }
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
        <span className={selectedOptions.length > 0 ? 'form__dropdown-value' : 'form__dropdown-placeholder'}>
          {triggerLabel}
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
            {filteredGroups ? (
              filteredGroups.length > 0 ? (
                filteredGroups.map(grp => (
                  <li key={grp.label} className="form__dropdown-group" role="group" aria-label={grp.label}>
                    <div className="form__dropdown-group-label">{grp.label}</div>
                    <ul className="form__dropdown-sublist">
                      {grp.options.map(o => {
                        const isChecked = selectedValues.includes(o.value);
                        return (
                          <li
                            key={o.value}
                            role="option"
                            aria-selected={isChecked}
                            className={clsx(
                              'form__dropdown-item',
                              isChecked && 'form__dropdown-item--active',
                              multiSelect && 'form__dropdown-item--multiselect'
                            )}
                            onClick={() => handleSelect(o)}
                          >
                            {multiSelect && (
                              <span className="form__dropdown-checkbox" aria-hidden>
                                <input type="checkbox" checked={isChecked} readOnly tabIndex={-1} />
                              </span>
                            )}
                            {o.label}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))
              ) : (
                <li className="form__dropdown-empty">No results</li>
              )
            ) : filteredFlat.length > 0 ? (
              filteredFlat.map(o => {
                const isChecked = selectedValues.includes(o.value);
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={isChecked}
                    className={clsx(
                      'form__dropdown-item',
                      isChecked && 'form__dropdown-item--active',
                      multiSelect && 'form__dropdown-item--multiselect'
                    )}
                    onClick={() => handleSelect(o)}
                  >
                    {multiSelect && (
                      <span className="form__dropdown-checkbox" aria-hidden>
                        <input type="checkbox" checked={isChecked} readOnly tabIndex={-1} />
                      </span>
                    )}
                    {o.label}
                  </li>
                );
              })
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
