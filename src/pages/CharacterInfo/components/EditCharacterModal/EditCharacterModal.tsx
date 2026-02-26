import React, { useState } from 'react';
import { updateCharacter, Character } from '../../../../data/characters';
import './EditCharacterModal.scss';

interface EditField {
  key: keyof Character;
  header: string;
  label: string;
  type: 'text' | 'textarea' | 'color';
  group: string;
  placeholder?: string;
}

const EDIT_FIELDS: EditField[] = [
  { key: 'nameThai', header: 'name (thai)', label: 'ชื่อ (Thai)', type: 'text', group: 'Names' },
  { key: 'nameEng', header: 'name (eng)', label: 'Name (English)', type: 'text', group: 'Names' },
  { key: 'nicknameThai', header: 'nickname (thai)', label: 'ชื่อเล่น (Thai)', type: 'text', group: 'Names' },
  { key: 'nicknameEng', header: 'nickname (eng)', label: 'Nickname (English)', type: 'text', group: 'Names' },
  { key: 'birthdate', header: 'birthdate', label: 'Birthdate', type: 'text', group: 'Personal Info', placeholder: 'e.g. March 15' },
  { key: 'genderIdentity', header: 'gender identity', label: 'Gender Identity', type: 'text', group: 'Personal Info' },
  { key: 'species', header: 'species', label: 'Species', type: 'text', group: 'Personal Info', placeholder: 'e.g. Demigod' },
  { key: 'height', header: 'height', label: 'Height (cm)', type: 'text', group: 'Personal Info' },
  { key: 'weight', header: 'weight', label: 'Weight (kg)', type: 'text', group: 'Personal Info' },
  { key: 'ethnicity', header: 'ethnicity', label: 'Ethnicity', type: 'text', group: 'Personal Info' },
  { key: 'nationality', header: 'nationality', label: 'Nationality', type: 'text', group: 'Personal Info' },
  { key: 'religion', header: 'religion', label: 'Religion', type: 'text', group: 'Personal Info' },
  { key: 'residence', header: 'residence', label: 'Residence', type: 'text', group: 'Personal Info' },
  { key: 'aliases', header: 'aliases', label: 'Aliases', type: 'text', group: 'Personal Info', placeholder: 'Comma separated' },
  { key: 'eyeColor', header: 'eye color', label: 'Eye Color', type: 'color', group: 'Appearance' },
  { key: 'hairColor', header: 'hair color', label: 'Hair Color', type: 'color', group: 'Appearance' },
  { key: 'appearance', header: 'appearance', label: 'Appearance', type: 'textarea', group: 'Appearance' },
  { key: 'personality', header: 'personality', label: 'Personality', type: 'textarea', group: 'Story' },
  { key: 'background', header: 'background', label: 'Background', type: 'textarea', group: 'Story' },
  { key: 'strengths', header: 'strengths', label: 'Strengths', type: 'textarea', group: 'Traits', placeholder: 'Comma separated, e.g. Swordsmanship: skilled with blade' },
  { key: 'weaknesses', header: 'weaknesses', label: 'Weaknesses', type: 'textarea', group: 'Traits', placeholder: 'Comma separated' },
  { key: 'abilities', header: 'abilities', label: 'Supernatural Abilities', type: 'textarea', group: 'Traits', placeholder: 'Comma separated' },
];

const GROUP_ICONS: Record<string, React.ReactNode> = {
  Names: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 11a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  'Personal Info': <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  Appearance: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /><path d="M8 15c1 2 3 3 4 3s3-1 4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  Story: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" /></svg>,
  Traits: <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 2l2.09 6.26L21 9.27l-5.18 4.73L17.82 22 12 17.77 6.18 22l1.64-7.73L2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>,
};

const GROUPS = ['Names', 'Personal Info', 'Appearance', 'Story', 'Traits'];

interface Props {
  char: Character;
  onClose: () => void;
  onSaved: (patch: Partial<Character>) => void;
}

export default function EditCharacterModal({ char, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    EDIT_FIELDS.forEach(field => { f[field.key] = String(char[field.key] ?? ''); });
    f.image = char.image || '';
    return f;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const fields: Record<string, string> = {};
    EDIT_FIELDS.forEach(f => { fields[f.header] = form[f.key] ?? ''; });
    fields['image url'] = form.image ?? '';
    const ok = await updateCharacter(char.characterId, fields);
    if (ok) {
      const patch: Partial<Character> = {};
      EDIT_FIELDS.forEach(f => { (patch as any)[f.key] = form[f.key] ?? ''; });
      patch.image = form.image || undefined;
      onSaved(patch);
    }
    setSaving(false);
  };

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="cs__edit-overlay" onClick={() => !saving && onClose()}>
      <div className="cs__edit" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="cs__edit-close" onClick={() => !saving && onClose()}>
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Hero header with portrait preview */}
        <div className="cs__edit-hero">
          <div className="cs__edit-portrait">
            {form.image ? (
              <img src={form.image} alt="Preview" className="cs__edit-portrait-img" referrerPolicy="no-referrer" />
            ) : (
              <div className="cs__edit-portrait-ph">
                <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            )}
          </div>
          <div className="cs__edit-hero-info">
            <h2 className="cs__edit-title">Edit Character</h2>
            <span className="cs__edit-subtitle">{char.nicknameEng} &middot; {char.nameEng}</span>
          </div>
        </div>

        {/* Image URL field */}
        <div className="cs__edit-image-field">
          <label className="cs__edit-label">
            <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Picture Link
          </label>
          <input
            type="text"
            className="cs__edit-input"
            value={form.image ?? ''}
            onChange={e => set('image', e.target.value)}
            placeholder="Paste Google Drive or image URL..."
          />
        </div>

        {/* Form sections */}
        <div className="cs__edit-form">
          {GROUPS.map(group => {
            const fields = EDIT_FIELDS.filter(f => f.group === group);
            return (
              <fieldset key={group} className="cs__edit-group">
                <legend className="cs__edit-legend">
                  {GROUP_ICONS[group]}
                  {group}
                </legend>
                <div className="cs__edit-fields">
                  {fields.map(f => (
                    <div key={f.key} className={`cs__edit-field ${f.type === 'textarea' ? 'cs__edit-field--wide' : ''}`}>
                      <label className="cs__edit-label">{f.label}</label>
                      {f.type === 'textarea' ? (
                        <textarea
                          className="cs__edit-input cs__edit-textarea"
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
                            placeholder="#000000"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          className="cs__edit-input"
                          value={form[f.key] ?? ''}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        {/* Footer */}
        <div className="cs__edit-footer">
          <button className="cs__edit-cancel" onClick={() => !saving && onClose()} disabled={saving}>
            Cancel
          </button>
          <button className="cs__edit-save" onClick={handleSave} disabled={saving}>
            {saving ? (
              <><span className="cs__edit-spinner" /> Saving...</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
