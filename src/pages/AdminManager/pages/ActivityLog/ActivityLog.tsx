import { useState, useEffect } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { ROLE } from '../../../../constants/role';
import { ActivityLog as ActivityLogType, ActivityLogCategory } from '../../../../types/activityLog';
import { fetchActivityLogs, editActivityLog, EditableLogFields } from '../../../../services/activityLog/activityLogService';
import Table, { Column } from '../../../../components/Table/Table';
import { Dropdown, Input } from '../../../../components/Form';
import Pencil from '../../../../icons/Pencil';
import { formatAppDateTime } from '../../../../utils/date';
import './ActivityLog.scss';

type CategoryFilter = ActivityLogCategory | 'all';

const CATEGORY_FILTERS: { label: string; value: CategoryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drachma', value: 'drachma' },
  { label: 'Item', value: 'item' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Stat', value: 'stat' },
  { label: 'Action', value: 'action' },
];

const CATEGORIES: ActivityLogCategory[] = ['drachma', 'item', 'equipment', 'stat', 'action'];

function formatDate(iso: string) {
  try {
    return formatAppDateTime(iso);
  } catch {
    return iso;
  }
}

type EditDraft = EditableLogFields;

export default function ActivityLog() {
  const { role, user } = useAuth();
  const isDev = role === ROLE.DEVELOPER;

  const [logs, setLogs] = useState<ActivityLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [editingLog, setEditingLog] = useState<ActivityLogType | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchActivityLogs()
      .then(data => {
        setLogs([...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      })
      .catch(() => {
        setLoadError('Failed to load activity logs.');
        setLoading(false);
      });
  }, []);

  const filtered = categoryFilter === 'all'
    ? logs
    : logs.filter(l => l.category === categoryFilter);

  const startEdit = (log: ActivityLogType) => {
    setEditingLog(log);
    setEditDraft({
      category: log.category,
      action: log.action,
      characterId: log.characterId,
      performedBy: log.performedBy,
      amount: log.amount,
      note: log.note ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingLog(null);
    setEditDraft(null);
  };

  const patch = (fields: Partial<EditDraft>) =>
    setEditDraft(prev => prev ? { ...prev, ...fields } : prev);

  const saveEdit = async () => {
    if (!editingLog?.id || !editDraft || !user) return;
    setIsSaving(true);
    try {
      const fields: Partial<EditableLogFields> = {
        category: editDraft.category,
        action: editDraft.action.trim(),
        characterId: editDraft.characterId.trim(),
        performedBy: editDraft.performedBy.trim(),
        note: editDraft.note?.trim() || undefined,
      };
      if (editDraft.amount !== undefined && editDraft.amount !== null && editDraft.amount !== ('' as unknown as number)) {
        fields.amount = Number(editDraft.amount);
      } else {
        fields.amount = undefined;
      }
      await editActivityLog(editingLog.id, fields, user.characterId);
      const now = new Date().toISOString();
      setLogs(prev => prev.map(l =>
        l.id === editingLog.id
          ? { ...l, ...fields, editedAt: now, editedBy: user.characterId }
          : l
      ));
      setEditingLog(null);
      setEditDraft(null);
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<ActivityLogType>[] = [
    {
      key: 'createdAt',
      label: 'Timestamp',
      width: '175px',
      render: row => <span className="al__timestamp">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      width: '110px',
      render: row => (
        <span className={`al__badge al__badge--${row.category}`}>{row.category}</span>
      ),
    },
    { key: 'action', label: 'Action', width: '170px' },
    { key: 'characterId', label: 'Character', width: '130px' },
    { key: 'performedBy', label: 'By', width: '130px' },
    {
      key: 'amount',
      label: 'Amount',
      width: '80px',
      render: row => row.amount !== undefined ? String(row.amount) : '—',
    },
  ];

  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <h2 className="activity-log-title">Activity Log</h2>
        <p className="activity-log-desc">
          Audit trail for drachma, item, equipment, stat, and action events
        </p>
      </div>

      <div className="al__filters">
        {CATEGORY_FILTERS.map(c => (
          <button
            key={c.value}
            className={`al__filter-btn${categoryFilter === c.value ? ' al__filter-btn--active' : ''}`}
            onClick={() => setCategoryFilter(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loadError && <p className="al__error">{loadError}</p>}

      <Table
        columns={columns}
        data={filtered}
        rowKey={row => row.id ?? row.createdAt}
        loading={loading}
        actions={
          isDev ? [{
            label: () => <Pencil width={14} height={14} />,
            onClick: startEdit,
          }] : []}
      />

      {/* Edit modal */}
      {isDev && editingLog && editDraft && (
        <div className="al__modal-backdrop" onClick={cancelEdit}>
          <div className="al__modal" onClick={e => e.stopPropagation()}>
            <h3 className="al__modal-title">Edit Log Entry</h3>

            <div className="al__form">
              <Dropdown
                label="Category"
                options={CATEGORIES.map(c => ({ label: c, value: c }))}
                value={editDraft.category}
                onChange={c => patch({ category: c as ActivityLogCategory })}
              />

              <Input
                label="Action"
                value={editDraft.action}
                onChange={e => patch({ action: e })}
              />

              <Input
                label="Character ID"
                value={editDraft.characterId}
                onChange={e => patch({ characterId: e })}
              />


              <Input
                label="Performed By"
                value={editDraft.performedBy}
                onChange={e => patch({ performedBy: e })}
              />

              <Input
                label="Amount"
                type="number"
                value={editDraft.amount?.toString() ?? ''}
                onChange={e => patch({ amount: e === '' ? undefined : Number(e) })}
              />
            </div>

            <div className="al__modal-actions">
              <button className="al__cancel-btn" onClick={cancelEdit}>Cancel</button>
              <button className="al__save-btn" onClick={saveEdit} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
