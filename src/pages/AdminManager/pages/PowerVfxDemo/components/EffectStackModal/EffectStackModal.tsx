import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { OptionGroup } from '../../../../../../components/Form';
import { CI_THEME_VARS, EFFECT_SIDE_LABEL, SIDE_LABEL } from '../../utils/constants';
import type { EffectModalSide, EffectSide } from '../../utils/types';
import { PANEL_SIDE } from '../../../../../../constants/battle';
import EmptyStateIcon from './icons/EmptyStateIcon';
import './EffectStackModal.scss';

export interface EffectStackModalProps {
  open: boolean;
  title: string;
  groups: OptionGroup[];
  selectedIds: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
  /** Map effect id (option value) to 'caster' | 'target' for badge (effect type); if omitted, badge uses modal side */
  optionSideByValue?: Record<string, EffectSide>;
  /** When set, modal is portaled into this container (e.g. arena half) and laid under team panel on that side */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Element to read --ci-* from; defaults to containerRef so theme works when portaled */
  themeSourceRef?: React.RefObject<HTMLElement | null>;
  /** When in-arena, which side so modal aligns left or right in that half */
  side?: EffectModalSide;
}

export default function EffectStackModal({
  open,
  title,
  groups,
  selectedIds,
  onApply,
  onClose,
  optionSideByValue,
  containerRef,
  themeSourceRef,
  side = PANEL_SIDE.LEFT,
}: EffectStackModalProps) {
  const [pending, setPending] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setPending([...selectedIds]);
      setSearchQuery('');
    }
  }, [open, selectedIds]);

  useLayoutEffect(() => {
    if (!open || !backdropRef.current) return;
    const source = themeSourceRef?.current ?? containerRef?.current;
    if (!source) return;
    const s = getComputedStyle(source);
    const themeVars: Record<string, string> = {};
    CI_THEME_VARS.forEach((name) => {
      const val = s.getPropertyValue(name).trim();
      if (val) themeVars[name] = val;
    });
    Object.assign(backdropRef.current.style, themeVars);
  }, [open, themeSourceRef, containerRef]);

  const toggle = (value: string) => {
    const next = pending.includes(value)
      ? pending.filter((id) => id !== value)
      : [...pending, value];
    setPending(next);
    onApply(next);
  };

  const handleClear = () => {
    setPending([]);
    onApply([]);
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredGroups = q
    ? groups
        .map((grp) => ({
          ...grp,
          options: grp.options.filter(
            (o: { value: string; label: string }) =>
              o.label.toLowerCase().includes(q)
          ),
        }))
        .filter((grp) => grp.options.length > 0)
    : groups;

  /** Split "Label (description)" into { main, desc }; if no parens, desc is empty. */
  const parseOptionLabel = (label: string): { main: string; desc: string } => {
    const match = label.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
    if (match) return { main: match[1].trim(), desc: match[2].trim() };
    return { main: label.trim(), desc: '' };
  };

  /** Badge per option: effect type (caster/target) when optionSideByValue is provided; else panel side (Left/Right) */
  const getBadgeForValue = (value: string): { label: string; title: string } => {
    const effectSide = optionSideByValue?.[value];
    if (effectSide === EFFECT_SIDE_LABEL.TARGET) return { label: 'T', title: EFFECT_SIDE_LABEL.TARGET };
    if (effectSide === EFFECT_SIDE_LABEL.CASTER) return { label: 'C', title: EFFECT_SIDE_LABEL.CASTER };
    return { label: side === PANEL_SIDE.LEFT ? 'L' : 'R', title: side === PANEL_SIDE.LEFT ? SIDE_LABEL.LEFT : SIDE_LABEL.RIGHT };
  };

  if (!open) return null;

  const inArena = Boolean(containerRef);
  const portalTarget = containerRef?.current ?? document.body;

  const content = (
    <div
      ref={backdropRef}
      className={`effect-stack-modal__backdrop ${inArena ? 'effect-stack-modal__backdrop--in-arena' : ''} ${side ? `effect-stack-modal__backdrop--${side}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="effect-stack-modal" onClick={(e) => e.stopPropagation()}>
        <div className="effect-stack-modal__header">
          <h3 className="effect-stack-modal__title">{title}</h3>
          <div className="effect-stack-modal__header-actions">
            {pending.length > 0 && (
              <button
                type="button"
                className="effect-stack-modal__clear"
                onClick={handleClear}
                aria-label="Clear all effects"
              >
                Clear
              </button>
            )}
            <button type="button" className="effect-stack-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>
        <div className="effect-stack-modal__search-wrap">
          <input
            type="search"
            className="effect-stack-modal__search"
            placeholder="Search effects"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search effects"
          />
        </div>
        <div className="effect-stack-modal__list">
          {filteredGroups.length === 0 ? (
            <div className="effect-stack-modal__empty" role="status">
              <span className="effect-stack-modal__empty-icon" aria-hidden>
                <EmptyStateIcon />
              </span>
              <p className="effect-stack-modal__empty-text">
                {q ? 'No effects match your search.' : 'No effects available.'}
              </p>
              {q && (
                <button
                  type="button"
                  className="effect-stack-modal__empty-clear-search"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
          filteredGroups.map((grp) => (
            <div key={grp.label} className="effect-stack-modal__group">
              <div className="effect-stack-modal__group-label">{grp.label}</div>
              <ul className="effect-stack-modal__options">
                {grp.options.map((o: { value: string; label: string }) => {
                  const checked = pending.includes(o.value);
                  const { main, desc } = parseOptionLabel(o.label);
                  const badge = getBadgeForValue(o.value);
                  return (
                    <li key={o.value}>
                      <label className="effect-stack-modal__option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(o.value)}
                        />
                        <span className="effect-stack-modal__option-text">
                          <span className="effect-stack-modal__option-label">{main}</span>
                          {desc && <span className="effect-stack-modal__option-desc">{desc}</span>}
                        </span>
                        <span
                          className={`effect-stack-modal__option-badge effect-stack-modal__option-badge--${badge.label === 'T' ? 'target' : 'caster'}`}
                          title={badge.title}
                          aria-hidden
                        >
                          {badge.label}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, portalTarget);
}
