import { ROLE } from '../../../../../../constants/role';
import type { MergedUser } from '../../User';
import Close from '../../../../../../icons/Close';
import './UserOverview.scss';

interface Props {
  user: MergedUser;
  isDev: boolean;
  onClose: () => void;
}

const PRACTICE_STATS = [
  { key: 'strength', label: 'STR' },
  { key: 'mobility', label: 'MOB' },
  { key: 'intelligence', label: 'INT' },
  { key: 'technique', label: 'TEC' },
  { key: 'experience', label: 'EXP' },
  { key: 'fortune', label: 'FOR' },
] as const;

function InfoRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="uo__info-row">
      <span className="uo__info-label">{label}</span>
      <span className="uo__info-value">{value}</span>
    </div>
  );
}

export default function UserOverview({ user, onClose }: Props) {
  const roleCls = (() => {
    const r = user.role.toLowerCase();
    return r === ROLE.DEVELOPER ? 'user__role--dev'
      : r === ROLE.ADMIN ? 'user__role--admin'
        : 'user__role--player';
  })();

  return (
    <div className="uo__overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="uo">
        {/* Header */}
        <div className="uo__header">
          <button className="uo__close" onClick={onClose}>
            <Close width={18} height={18} />
          </button>
        </div>

        {/* Profile */}
        <div className="uo__profile">
          <div className="uo__avatar" style={user.theme?.[0] ? { background: `color-mix(in srgb, ${user.theme[0]} 15%, var(--ci-surface, #f8f8f8))`, color: user.theme[0] } : undefined}>
            {user.image
              ? <img src={user.image} alt="" referrerPolicy="no-referrer" />
              : <span>{(user.nicknameEng ?? user.characterId ?? '?')[0].toUpperCase()}</span>
            }
          </div>
          <div className="uo__profile-info">
            <h3
              className="uo__name">{user.nicknameEng || user.characterId}
              {user.nicknameThai && <span className="uo__name-thai">{user.nicknameThai}</span>}
            </h3>
            <span className={`user__role ${roleCls}`}>{user.role}</span>
            <p className="uo__id">{user.characterId}</p>
          </div>
        </div>

        {/* Body */}
        <div className="uo__body">
          {/* Identity */}
          <div className="uo__section">
            <h4 className="uo__section-title">Identity</h4>
            <InfoRow label="Name" value={user.nameEng?.replace(/\n/g, ' ').trim()} />
            {user.nameThai && <InfoRow label="Name (Thai)" value={user.nameThai} />}
            <InfoRow label="Deity" value={user.deityBlood} />
            <InfoRow label="Cabin" value={user.cabin} />
            <InfoRow label="Sex" value={user.sex} />
            <InfoRow label="Age" value={user.age} />
            <InfoRow label="Species" value={user.species} />
          </div>

          {/* Combat Stats */}
          <div className="uo__section">
            <h4 className="uo__section-title">Combat</h4>
            <div className="uo__stats-grid">
              <div className="uo__stat">
                <span className="uo__stat-label">HP</span>
                <span className="uo__stat-value">{user.hp ?? '\u2014'}</span>
              </div>
              <div className="uo__stat">
                <span className="uo__stat-label">DMG</span>
                <span className="uo__stat-value">{user.damage ?? '\u2014'}</span>
              </div>
              <div className="uo__stat">
                <span className="uo__stat-label">SPD</span>
                <span className="uo__stat-value">{user.speed ?? '\u2014'}</span>
              </div>
              <div className="uo__stat">
                <span className="uo__stat-label">Currency</span>
                <span className="uo__stat-value">{user.currency ?? '\u2014'}</span>
              </div>
            </div>
          </div>

          {/* Practice Stats */}
          <div className="uo__section">
            <h4 className="uo__section-title">Practice</h4>
            <div className="uo__bars">
              {PRACTICE_STATS.map(s => {
                const val = user[s.key] as number | undefined;
                return (
                  <div key={s.key} className="uo__bar-row">
                    <span className="uo__bar-label">{s.label}</span>
                    <div className="uo__bar-track">
                      <div className="uo__bar-fill" style={{ width: `${((val ?? 0) / 5) * 100}%` }} />
                    </div>
                    <span className="uo__bar-value">{val ?? 0}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account */}
          <div className="uo__section">
            <h4 className="uo__section-title">Account</h4>
            <InfoRow label="Password" value={user.password} />
            <InfoRow label="Role" value={user.role} />
          </div>
        </div>

        {/* Footer */}
        <div className="uo__footer">
          <span className="uo__manage-label">Manage Member Info</span>
        </div>
      </div>
    </div>
  );
}
