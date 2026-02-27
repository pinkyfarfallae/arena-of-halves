import { useState } from 'react';
import {
  createUser, patchCharacter,
  type UserRecord, type CreateUserPayload,
} from '../../../../../../data/characters';
import { useAuth } from '../../../../../../hooks/useAuth';
import { DEITY, DEITY_CABIN } from '../../../../../../constants/deities';
import { Input, Dropdown } from '../../../../../../components/Form';
import './UserModal.scss';
import { ROLE } from '../../../../../../constants/role';

const DEITY_OPTIONS = Object.values(DEITY)
  .filter(d => d !== DEITY.PERSEPHONE && d !== DEITY.HERA)
  .map(d => ({ value: d, label: d }));

interface CreateProps {
  mode: 'create';
  onClose: () => void;
  onDone: () => void;
}

interface EditProps {
  mode: 'edit';
  user: UserRecord;
  isDev: boolean;
  onClose: () => void;
  onDone: () => void;
}

type Props = CreateProps | EditProps;

const CREATE_FIELDS: { key: string; label: string; placeholder?: string; required?: boolean }[] = [
  { key: 'characterId', label: 'Character ID', required: true },
  { key: 'password', label: 'Password', placeholder: 'Login password', required: true },
  { key: 'nameThai', label: 'ชื่อ (Thai)', placeholder: 'ชื่อภาษาไทย', required: true },
  { key: 'nameEng', label: 'Name (English)', placeholder: 'Full name in English', required: true },
  { key: 'nicknameThai', label: 'ชื่อเล่น (Thai)', placeholder: 'ชื่อเล่น', required: true },
  { key: 'nicknameEng', label: 'Nickname (English)', placeholder: 'Nickname in English', required: true },
];

export default function UserModal(props: Props) {
  const { mode, onClose, onDone } = props;
  const isEdit = mode === 'edit';
  const { user: authUser } = useAuth();

  const [form, setForm] = useState<Record<string, string>>(() => {
    if (isEdit) {
      const init: Record<string, string> = {
        password: props.user.password,
        role: props.user.role,
      };
      return init;
    }
    return {
      characterId: '',
      password: '',
      nameThai: '',
      nameEng: '',
      nicknameThai: '',
      nicknameEng: '',
      deityBlood: '',
      sex: '',
    };
  });

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const set = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setResult(null);
  };

  const canSubmit = isEdit
    ? !!(form.password ?? '').trim()
    : CREATE_FIELDS.every(f => (form[f.key] ?? '').trim()) && !!form.deityBlood && !!form.sex;

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setResult(null);

    if (isEdit) {
      const params: Record<string, string> = {};
      if (form.password !== props.user.password) params.password = form.password;
      if (props.isDev && form.role !== props.user.role) params.role = form.role;
      if (Object.keys(params).length === 0) {
        onClose();
        return;
      }
      const ok = await patchCharacter(props.user.characterId, params);
      setSaving(false);
      if (ok) {
        onDone();
        onClose();
      } else {
        setResult({ ok: false, msg: 'Failed to save. Check console.' });
      }
    } else {
      const payload: CreateUserPayload = {
        characterId: form.characterId.trim(),
        password: form.password.trim(),
        nameThai: form.nameThai.trim(),
        nameEng: form.nameEng.trim(),
        nicknameThai: form.nicknameThai.trim(),
        nicknameEng: form.nicknameEng.trim(),
        deityBlood: form.deityBlood,
        sex: form.sex,
        cabin: String(DEITY_CABIN[form.deityBlood] ?? 0),
      };
      const ok = await createUser(payload);
      setSaving(false);
      if (ok) {
        setResult({ ok: true, msg: `User "${form.nicknameEng.trim()}" created` });
        setForm({ characterId: '', password: '', nameThai: '', nameEng: '', nicknameThai: '', nicknameEng: '', deityBlood: '', sex: '' });
        onDone();
      } else {
        setResult({ ok: false, msg: 'Failed to create user. Check console.' });
      }
    }
  };

  return (
    <div className="um__overlay">
      <div className="um">
        <div className="um__header">
          <h2 className="um__title">{isEdit ? `Edit ${props.user.characterId}` : 'Create User'}</h2>
          <button className="um__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="um__body">
          <div className="um__form">
            {isEdit ? (
              <>
                <Input
                  label="Password"
                  value={form.password}
                  onChange={v => set('password', v)}
                  disabled={saving}
                  required
                />
                {props.isDev && (
                  <Dropdown
                    label="Role"
                    value={form.role}
                    onChange={v => set('role', v)}
                    options={[
                      { value: ROLE.DEVELOPER, label: 'Developer' },
                      { value: ROLE.ADMIN, label: 'Admin' },
                      { value: ROLE.PLAYER, label: 'Player' },
                    ]}
                    disabled={saving}
                  />
                )}
              </>
            ) : (
              <>
                {CREATE_FIELDS.map(f => {
                  const ph = f.key === 'characterId'
                    ? `e.g. ${authUser?.characterId ?? 'chb-001'}`
                    : f.placeholder;
                  return (
                    <Input
                      key={f.key}
                      label={f.label}
                      placeholder={ph}
                      value={form[f.key] ?? ''}
                      onChange={v => set(f.key, v)}
                      disabled={saving}
                      required={f.required}
                    />
                  );
                })}
                <Dropdown
                  label="Deity Blood"
                  value={form.deityBlood}
                  onChange={v => set('deityBlood', v)}
                  options={DEITY_OPTIONS}
                  placeholder="Select deity"
                  disabled={saving}

                  required
                  searchable
                />
                <div className="um__field">
                  <label className="um__label">Sex <span className="um__req">*</span></label>
                  <div className="um__sex-toggle">
                    <button
                      type="button"
                      className={`um__sex-btn um__sex-btn--male ${form.sex === 'Male' ? 'um__sex-btn--active' : ''}`}
                      onClick={() => set('sex', 'Male')}
                      disabled={saving}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="10.5" cy="13.5" r="5.5" /><path d="M16 8l4-4M20 4v5M20 4h-5" />
                      </svg>
                      Male
                    </button>
                    <button
                      type="button"
                      className={`um__sex-btn um__sex-btn--female ${form.sex === 'Female' ? 'um__sex-btn--active' : ''}`}
                      onClick={() => set('sex', 'Female')}
                      disabled={saving}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="9" r="5.5" /><path d="M12 14.5V22M9 19h6" />
                      </svg>
                      Female
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {result && (
            <div className={`um__result ${result.ok ? 'um__result--ok' : 'um__result--err'}`}>
              {result.msg}
            </div>
          )}
        </div>

        <div className="um__footer">
          <button className="um__cancel" onClick={onClose}>Cancel</button>
          <button className="um__submit" onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
