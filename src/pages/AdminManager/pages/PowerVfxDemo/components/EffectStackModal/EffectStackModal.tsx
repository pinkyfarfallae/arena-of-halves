import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { OptionGroup } from '../../../../../../components/Form';
import './EffectStackModal.scss';

const CI_VARS = [
  '--ci-border',
  '--ci-muted',
  '--ci-primary',
  '--ci-primary-hover',
  '--ci-bg',
  '--ci-fg',
  '--ci-surface',
  '--ci-surface-hover',
  '--ci-light',
] as const;

export interface EffectStackModalProps {
  open: boolean;
  title: string;
  groups: OptionGroup[];
  selectedIds: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
  /** When set, modal is portaled into this container (e.g. arena half) and laid under team panel on that side */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Element to read --ci-* from; defaults to containerRef so theme works when portaled */
  themeSourceRef?: React.RefObject<HTMLElement | null>;
  /** When in-arena, which side so modal aligns left or right in that half */
  side?: 'left' | 'right';
}

export default function EffectStackModal({
  open,
  title,
  groups,
  selectedIds,
  onApply,
  onClose,
  containerRef,
  themeSourceRef,
  side = 'left',
}: EffectStackModalProps) {
  const [pending, setPending] = useState<string[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setPending([...selectedIds]);
  }, [open, selectedIds]);

  useLayoutEffect(() => {
    if (!open || !backdropRef.current) return;
    const source = themeSourceRef?.current ?? containerRef?.current;
    if (!source) return;
    const s = getComputedStyle(source);
    const themeVars: Record<string, string> = {};
    CI_VARS.forEach((name) => {
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
          <button type="button" className="effect-stack-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="effect-stack-modal__list">
          {groups.map((grp) => (
            <div key={grp.label} className="effect-stack-modal__group">
              <div className="effect-stack-modal__group-label">{grp.label}</div>
              <ul className="effect-stack-modal__options">
                {grp.options.map((o: { value: string; label: string }) => {
                  const checked = pending.includes(o.value);
                  return (
                    <li key={o.value}>
                      <label className="effect-stack-modal__option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(o.value)}
                        />
                        <span>{o.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(content, portalTarget);
}
