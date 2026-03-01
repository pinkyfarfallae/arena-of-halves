import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { ROLE } from '../../../../constants/role';
import {
  fetchAllUsers, fetchAllCharacters, deleteUser,
  type UserRecord, type Character,
} from '../../../../data/characters';
import Table, { type Column } from '../../../../components/Table/Table';
import { Dropdown } from '../../../../components/Form';
import UserModal from './components/UserModal/UserModal';
import UserOverview from './components/UserOverview/UserOverview';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import Plus from '../../../../icons/Plus';
import Search from '../../../../icons/Search';
import Eye from '../../../../icons/Eye';
import Pencil from '../../../../icons/Pencil';
import Trash from '../../../../icons/Trash';
import './User.scss';

export type MergedUser = UserRecord & Partial<Character>;

export default function User() {
  const { role } = useAuth();
  const isDev = role === ROLE.DEVELOPER;
  const [users, setUsers] = useState<MergedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<MergedUser | null>(null);
  const [viewUser, setViewUser] = useState<MergedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MergedUser | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const [userList, charList] = await Promise.all([
      fetchAllUsers(),
      fetchAllCharacters(),
    ]);
    const charMap = new Map(charList.map(c => [c.characterId.toLowerCase(), c]));
    const merged: MergedUser[] = userList.map(u => {
      const char = charMap.get(u.characterId.toLowerCase());
      return { ...u, ...char };
    });
    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') {
      list = list.filter(u => u.role.toLowerCase() === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.characterId.toLowerCase().includes(q) ||
        (u.nicknameEng ?? '').toLowerCase().includes(q) ||
        (u.nicknameThai ?? '').toLowerCase().includes(q) ||
        (u.nameEng ?? '').toLowerCase().includes(q) ||
        (u.nameThai ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, search, roleFilter]);

  const columns = useMemo<Column<MergedUser>[]>(() => [
    {
      key: 'nicknameEng' as keyof MergedUser & string,
      label: 'Nickname',
      render: (row) => {
        const themeColor = row.theme?.[0];
        const avatarStyle = themeColor
          ? { background: `color-mix(in srgb, ${themeColor} 15%, var(--ci-surface, #f8f8f8))`, color: themeColor }
          : undefined;
        return (
          <div className="user__nick-cell">
            <div className="user__avatar" style={avatarStyle}>
              {row.image
                ? <img src={row.image} alt="" referrerPolicy="no-referrer" />
                : <span>{(row.nicknameEng ?? row.characterId ?? '?')[0].toUpperCase()}</span>
              }
            </div>
            <div className="user__nick-text">
              <span className="user__nick-eng">{row.nicknameEng || row.characterId}</span>
              {row.nicknameThai && <span className="user__nick-thai">{row.nicknameThai}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'nameEng' as keyof MergedUser & string,
      label: 'Name',
      render: (row) => (
        <div className="user__name-cell">
          <span className="user__name-eng">{row.nameEng?.replace(/\n/g, ' ').trim() || '\u2014'}</span>
          {row.nameThai && <span className="user__name-thai">{row.nameThai}</span>}
        </div>
      ),
    },
    {
      key: 'deityBlood' as keyof MergedUser & string,
      label: 'Deity',
      render: (row) => row.deityBlood || '\u2014',
    },
    { key: 'characterId', label: 'ID' },
    { key: 'password', label: 'Password' },
    {
      key: 'role',
      label: 'Role',
      render: (row) => {
        const r = row.role.toLowerCase();
        const cls = r === ROLE.DEVELOPER ? 'user__role--dev'
          : r === ROLE.ADMIN ? 'user__role--admin'
            : 'user__role--player';
        return <span className={`user__role ${cls}`}>{row.role}</span>;
      },
    },
  ], []);

  return (
    <>
      <div className="admin__section">
        <div className="admin__section-header">
          <div>
            <h2 className="admin__section-title">User Accounts</h2>
            <p className="admin__section-desc">{users.length} registered user accounts</p>
          </div>
          <button className="admin__create-btn" onClick={() => setCreateOpen(true)}>
            <Plus width={14} height={14} />
            Create User
          </button>
        </div>

        <div className="user__toolbar">
          <div className="user__search">
            <Search width={14} height={14} className="user__search-icon" />
            <input
              className="user__search-input"
              type="text"
              placeholder="Search by name or ID"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Dropdown
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: ROLE.PLAYER, label: 'Player' },
              { value: ROLE.ADMIN, label: 'Admin' },
              { value: ROLE.DEVELOPER, label: 'Developer' },
            ]}
            className='user__role-filter'
          />
        </div>

        <Table
          columns={columns}
          data={filtered}
          rowKey={(r: MergedUser) => r.characterId}
          actions={[
            {
              label: () => <Eye width={14} height={14} />,
              onClick: (r: MergedUser) => setViewUser(r),
            },
            {
              label: () => <Pencil width={14} height={14} />,
              onClick: (r: MergedUser) => setEditUser(r),
            },
            {
              label: () => <Trash width={14} height={14} />,
              onClick: (r: MergedUser) => setDeleteTarget(r),
            },
          ]}
          loading={loading}
        />
      </div>

      {createOpen && (
        <UserModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onDone={(apiCall) => {
            setCreateOpen(false);
            setSaving(true);
            apiCall.then(() => loadUsers()).finally(() => setSaving(false));
          }}
        />
      )}

      {editUser && (
        <UserModal
          mode="edit"
          user={editUser}
          isDev={isDev}
          onClose={() => setEditUser(null)}
          onDone={(apiCall) => {
            setEditUser(null);
            setSaving(true);
            apiCall.then(() => loadUsers()).finally(() => setSaving(false));
          }}
        />
      )}

      {viewUser && (
        <UserOverview
          user={viewUser}
          isDev={isDev}
          onClose={() => setViewUser(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete User"
          message={`Are you sure you want to delete "${deleteTarget.nicknameEng || deleteTarget.characterId}"? This will remove both the user account and character data. This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const id = deleteTarget.characterId;
            setDeleteTarget(null);
            setSaving(true);
            deleteUser(id)
              .then(() => loadUsers())
              .finally(() => setSaving(false));
          }}
        />
      )}

      {saving && (
        <div className="user__saving-overlay">
          <div className="app-loader__ring" />
        </div>
      )}
    </>
  );
}
