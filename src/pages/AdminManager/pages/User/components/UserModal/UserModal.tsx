import { useState } from 'react';
import {
  createUser, editUser,
  type UserRecord, type CreateUserPayload,
} from '../../../../../../data/characters';
import { useAuth } from '../../../../../../hooks/useAuth';
import { DEITY, DEITY_CABIN } from '../../../../../../constants/deities';
import { Input, Dropdown } from '../../../../../../components/Form';
import Close from '../../../../../../icons/Close';
import Male from '../../../../../../icons/Male';
import Female from '../../../../../../icons/Female';
import './UserModal.scss';
import { ROLE } from '../../../../../../constants/role';
import { SEX } from '../../../../../../constants/sex';

const DEITY_OPTIONS = Object.values(DEITY)
  .filter(d => d !== DEITY.PERSEPHONE && d !== DEITY.HERA)
  .map(d => ({ value: d, label: d }));

interface CreateProps {
  mode: 'create';
  onClose: () => void;
  onDone: (apiCall: Promise<boolean>) => void;
}

interface EditProps {
  mode: 'edit';
  user: UserRecord;
  isDev: boolean;
  onClose: () => void;
  onDone: (apiCall: Promise<boolean>) => void;
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

  const set = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const canSubmit = isEdit
    ? !!(form.password ?? '').trim() && !!(form.role ?? '').trim()
    : CREATE_FIELDS.every(f => (form[f.key] ?? '').trim()) && !!form.deityBlood && !!form.sex;

  const handleSubmit = () => {
    if (!canSubmit) return;

    if (isEdit) {
      const params: Record<string, string> = {};
      if (form.password !== props.user.password) params.password = form.password;
      if (props.isDev && form.role !== props.user.role) params.role = form.role;
      if (Object.keys(params).length === 0) {
        onClose();
        return;
      }
      // Close modal immediately, parent shows loading overlay
      onDone(editUser(props.user.characterId, params));
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
      // Close modal immediately, parent shows loading overlay
      onDone(createUser(payload));
    }
  };

  return (
    <div className="um__overlay">
      <div className="um">
        <div className="um__header">
          <h2 className="um__title">{isEdit ? <>Edit <b>{props.user.characterId}</b></> : 'Create User'}</h2>
          <button className="um__close" onClick={onClose}>
            <Close width={18} height={18} />
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
                    required
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
                  required
                  searchable
                />
                <div className="um__field">
                  <label className="um__label">Sex <span className="um__req">*</span></label>
                  <div className="um__sex-toggle">
                    <button
                      type="button"
                      className={`um__sex-btn um__sex-btn--male ${form.sex === SEX.MALE ? 'um__sex-btn--active' : ''}`}
                      onClick={() => set('sex', SEX.MALE)}
                    >
                      <Male width={14} height={14} />
                      Male
                    </button>
                    <button
                      type="button"
                      className={`um__sex-btn um__sex-btn--female ${form.sex === SEX.FEMALE ? 'um__sex-btn--active' : ''}`}
                      onClick={() => set('sex', SEX.FEMALE)}
                    >
                      <Female width={14} height={14} />
                      Female
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        <div className="um__footer">
          <button className="um__cancel" onClick={onClose}>Cancel</button>
          <button className="um__submit" onClick={handleSubmit} disabled={!canSubmit}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
