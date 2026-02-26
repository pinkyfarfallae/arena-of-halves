import { useState } from 'react';
import { patchCharacter, Character } from '../../../../data/characters';
import { EDIT_FIELDS, GROUP_ICONS, GROUPS } from '../../constants/editFields';
import './EditCharacterModal.scss';

interface Props {
  char: Character;
  onClose: () => void;
  onSaved: () => void;
}

/* Parse "Label: description" entries from comma-separated string */
function parseTraits(raw: string): { label: string; desc: string }[] {
  if (!raw.trim()) return [];
  return raw.split(',').map(s => {
    const i = s.indexOf(':');
    return i === -1
      ? { label: s.trim(), desc: '' }
      : { label: s.substring(0, i).trim(), desc: s.substring(i + 1).trim() };
  }).filter(t => t.label);
}

function serializeTraits(traits: { label: string; desc: string }[]): string {
  return traits.map(t => t.desc ? `${t.label}: ${t.desc}` : t.label).join(', ');
}

/* Parse comma-separated aliases */
function parseChips(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

const TRAIT_KEYS = new Set(['strengths', 'weaknesses', 'abilities']);
const ALIAS_KEY = 'aliases';
export default function EditCharacterModal({ char, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    EDIT_FIELDS.forEach(field => { f[field.key] = String(char[field.key] ?? ''); });
    f.image = char.image || '';
    return f;
  });

  const [imgError, setImgError] = useState(false);
  const [attempted, setAttempted] = useState(false);

  /* Alias chips state */
  const [aliasChips, setAliasChips] = useState<string[]>(() => parseChips(String(char.aliases ?? '')));
  const [aliasInput, setAliasInput] = useState('');

  /* Trait entries state */
  const [traits, setTraits] = useState<Record<string, { label: string; desc: string }[]>>(() => {
    const t: Record<string, { label: string; desc: string }[]> = {};
    TRAIT_KEYS.forEach(key => { t[key] = parseTraits(String(char[key as keyof Character] ?? '')); });
    return t;
  });

  /* Birthdate validation */
  const birthdateVal = (form.birthdate ?? '').trim();
  const birthdateInvalid = !!(birthdateVal && birthdateVal.toLowerCase() !== 'unknown' && isNaN(Date.parse(birthdateVal)));

  /* Form validity (computed) */
  const isFormValid = (() => {
    for (const f of EDIT_FIELDS) {
      if (f.required && !(form[f.key] ?? '').trim()) return false;
    }
    return !birthdateInvalid;
  })();

  const set = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  /* Alias helpers */
  const addAlias = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !aliasChips.includes(trimmed)) {
      const next = [...aliasChips, trimmed];
      setAliasChips(next);
      setForm(prev => ({ ...prev, aliases: next.join(', ') }));
    }
    setAliasInput('');
  };

  const removeAlias = (idx: number) => {
    const next = aliasChips.filter((_, i) => i !== idx);
    setAliasChips(next);
    setForm(prev => ({ ...prev, aliases: next.join(', ') }));
  };

  const handleAliasKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addAlias(aliasInput);
    } else if (e.key === 'Backspace' && !aliasInput && aliasChips.length) {
      removeAlias(aliasChips.length - 1);
    }
  };

  /* Trait helpers */
  const updateTrait = (key: string, idx: number, field: 'label' | 'desc', value: string) => {
    setTraits(prev => {
      const next = [...(prev[key] || [])];
      next[idx] = { ...next[idx], [field]: value };
      setForm(f => ({ ...f, [key]: serializeTraits(next) }));
      return { ...prev, [key]: next };
    });
  };

  const addTrait = (key: string) => {
    setTraits(prev => {
      const next = [...(prev[key] || []), { label: '', desc: '' }];
      return { ...prev, [key]: next };
    });
  };

  const removeTrait = (key: string, idx: number) => {
    setTraits(prev => {
      const next = (prev[key] || []).filter((_, i) => i !== idx);
      setForm(f => ({ ...f, [key]: serializeTraits(next) }));
      return { ...prev, [key]: next };
    });
  };

  const handleSave = async () => {
    setAttempted(true);
    if (!isFormValid) return;
    const fields: Record<string, string> = {};
    EDIT_FIELDS.forEach(f => {
      const newVal = form[f.key] ?? '';
      const oldVal = String(char[f.key as keyof Character] ?? '');
      if (newVal !== oldVal) fields[f.header] = newVal;
    });
    const newImg = form.image ?? '';
    const oldImg = char.image || '';
    if (newImg !== oldImg) fields['image url'] = newImg;
    if (Object.keys(fields).length > 0) {
      await patchCharacter(char.characterId, fields);
    }
    onSaved();
  };

  return (
    <div className="cs__edit-overlay">
      <div className="cs__edit">

        {/* ── Sticky Header ── */}
        <div className="cs__edit-header">
          <h2 className="cs__edit-title">Edit Character</h2>
          <button className="cs__edit-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="cs__edit-body">

          {/* Picture link + preview */}
          <div className="cs__edit-section">
            {form.image && !imgError ? (
              <img
                src={form.image}
                alt="Preview"
                className="cs__edit-preview"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : form.image && imgError ? (
              <div className="cs__edit-preview-err">
                <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            ) : (
              <div className="cs__edit-preview-ph">
                <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            <div className="cs__edit-img-fields">
              <label className="cs__edit-label">Picture Link</label>
              <input
                type="text"
                className="cs__edit-input"
                value={form.image ?? ''}
                onChange={e => { set('image', e.target.value); setImgError(false); }}
                placeholder="Paste image URL"
              />
            </div>
          </div>

          {/* Form groups */}
          {GROUPS.map(group => {
            const fields = EDIT_FIELDS.filter(f => f.group === group);
            return (
              <fieldset key={group} className="cs__edit-group">
                <legend className="cs__edit-legend">
                  {GROUP_ICONS[group]}
                  {group}
                </legend>
                <div className="cs__edit-fields">
                  {fields.map(f => {
                    const isEmpty = f.required && !(form[f.key] ?? '').trim();
                    const isBdError = f.key === 'birthdate' && birthdateInvalid;
                    const hasError = (attempted && isEmpty) || isBdError;

                    /* ── Alias chips ── */
                    if (f.key === ALIAS_KEY) {
                      return (
                        <div key={f.key} className="cs__edit-field cs__edit-field--wide">
                          <label className="cs__edit-label">{f.label}</label>
                          <div className="cs__edit-chips">
                            {aliasChips.map((chip, i) => (
                              <span key={i} className="cs__edit-chip">
                                {chip}
                                <button type="button" className="cs__edit-chip-x" onClick={() => removeAlias(i)}>
                                  <svg viewBox="0 0 16 16" width="10" height="10"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                </button>
                              </span>
                            ))}
                            <input
                              type="text"
                              className="cs__edit-chip-input"
                              value={aliasInput}
                              onChange={e => setAliasInput(e.target.value)}
                              onKeyDown={handleAliasKey}
                              onBlur={() => { if (aliasInput.trim()) addAlias(aliasInput); }}
                              placeholder={aliasChips.length ? '' : (f.placeholder || 'Type and press Enter')}
                            />
                          </div>
                        </div>
                      );
                    }

                    /* ── Trait entries ── */
                    if (TRAIT_KEYS.has(f.key)) {
                      const entries = traits[f.key] || [];
                      return (
                        <div key={f.key} className="cs__edit-field cs__edit-field--wide">
                          <label className="cs__edit-label">{f.label}</label>
                          <div className="cs__edit-traits">
                            {entries.map((t, i) => (
                              <div key={i} className="cs__edit-trait">
                                <input
                                  type="text"
                                  className="cs__edit-input cs__edit-trait-label"
                                  value={t.label}
                                  onChange={e => updateTrait(f.key, i, 'label', e.target.value)}
                                  placeholder="Label"
                                />
                                <input
                                  type="text"
                                  className="cs__edit-input cs__edit-trait-desc"
                                  value={t.desc}
                                  onChange={e => updateTrait(f.key, i, 'desc', e.target.value)}
                                  placeholder="Description"
                                />
                                <button type="button" className="cs__edit-trait-rm" onClick={() => removeTrait(f.key, i)}>
                                  <svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                                </button>
                              </div>
                            ))}
                            <button type="button" className="cs__edit-trait-add" onClick={() => addTrait(f.key)}>
                              <svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    }

                    /* ── Standard fields ── */
                    return (
                      <div key={f.key} className={`cs__edit-field ${f.type === 'textarea' ? 'cs__edit-field--wide' : ''} ${hasError ? 'cs__edit-field--error' : ''}`}>
                        <label className="cs__edit-label">
                          {f.label}
                          {f.required && <span className="cs__edit-req">*</span>}
                        </label>
                        {f.type === 'textarea' ? (
                          <textarea
                            className={`cs__edit-input cs__edit-textarea ${hasError ? 'cs__edit-input--error' : ''}`}
                            value={form[f.key] ?? ''}
                            onChange={e => set(f.key, e.target.value)}
                            rows={3}
                            placeholder={f.placeholder}
                          />
                        ) : f.type === 'color' ? (
                          <div className="cs__edit-color-wrap">
                            <input
                              type="color"
                              className="cs__edit-color"
                              value={form[f.key] || '#888888'}
                              onChange={e => set(f.key, e.target.value)}
                            />
                            <input
                              type="text"
                              className="cs__edit-input"
                              value={form[f.key] ?? ''}
                              onChange={e => set(f.key, e.target.value)}
                              placeholder={f.placeholder}
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            className={`cs__edit-input ${hasError ? 'cs__edit-input--error' : ''}`}
                            value={form[f.key] ?? ''}
                            onChange={e => set(f.key, e.target.value)}
                            placeholder={f.placeholder}
                          />
                        )}
                        {hasError && <span className="cs__edit-err-msg">{isBdError ? "Must be a date or 'unknown'" : 'Required'}</span>}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        {/* ── Sticky Footer ── */}
        <div className="cs__edit-footer">
          <button className="cs__edit-cancel" onClick={onClose}>Cancel</button>
          <button className="cs__edit-save" onClick={handleSave} disabled={!isFormValid}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
