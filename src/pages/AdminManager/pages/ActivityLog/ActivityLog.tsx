import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { ROLE } from '../../../../constants/role';
import { ActivityLog as ActivityLogType, ActivityLogCategory } from '../../../../types/activityLog';
import { fetchActivityLogs, fetchActivityLogsForCharacter, editActivityLog, deleteActivityLog, EditableLogFields } from '../../../../services/activityLog/activityLogService';
import { fetchAcceptedClaimsForCharacter } from '../../../../services/daily/dailyClaimService';
import { formatAppDate, getAppDateString } from '../../../../utils/date';
import { Dropdown, Input } from '../../../../components/Form';
import Pencil from '../../../../icons/Pencil';
import Trash from '../../../../icons/Trash';
import './ActivityLog.scss';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import { toTitleCase } from '../../../../utils/formatText';
import { Character, fetchAllCharacters } from '../../../../data/characters';
import Close from '../../../../icons/Close';
import Refresh from '../../../IrisMessage/icons/Refresh';
import { ACTIVITY_LOG_ACTIONS, ACTIVITY_LOG_CATEGORY, ACTIVITY_LOG_SOURCES } from '../../../../constants/activityLog';
import { EQUIPMENT_UPGRADE_OUTCOME } from '../../../../constants/equipment';

type CategoryFilter = ActivityLogCategory | 'all';

const CATEGORY_FILTERS: { label: string; value: CategoryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Drachma', value: ACTIVITY_LOG_CATEGORY.DRACHMA },
  { label: 'Item', value: ACTIVITY_LOG_CATEGORY.ITEM },
  { label: 'Equipment', value: ACTIVITY_LOG_CATEGORY.EQUIPMENT },
  { label: 'Stat', value: ACTIVITY_LOG_CATEGORY.STAT },
  { label: 'Action', value: ACTIVITY_LOG_CATEGORY.ACTION },
];

const CATEGORIES: ActivityLogCategory[] = [ACTIVITY_LOG_CATEGORY.DRACHMA, ACTIVITY_LOG_CATEGORY.ITEM, ACTIVITY_LOG_CATEGORY.EQUIPMENT, ACTIVITY_LOG_CATEGORY.STAT, ACTIVITY_LOG_CATEGORY.ACTION];

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Bangkok',
      timeZoneName: 'short',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function describeLog(log: ActivityLogType): string {
  const meta = (log.metadata as Record<string, any>) || {};
  const source = String(meta.source || '');
  const amt = log.amount != null ? log.amount.toLocaleString() : null;

  if (log.category === ACTIVITY_LOG_CATEGORY.DRACHMA) {
    const isEarn = [ACTIVITY_LOG_ACTIONS.AWARD, ACTIVITY_LOG_ACTIONS.EARN_DRACHMA].includes(log.action);
    const isSpend = [ACTIVITY_LOG_ACTIONS.DEDUCT, ACTIVITY_LOG_ACTIONS.SPEND_DRACHMA, ACTIVITY_LOG_ACTIONS.CONSUME_DRACHMA].includes(log.action);
    if (isEarn) return `Earned ${amt} drachma${source ? ` · ${toTitleCase(source)}` : ''}`;
    if (isSpend) return `Spent ${amt} drachma${source ? ` · ${toTitleCase(source)}` : ''}`;
  }
  if (log.category === ACTIVITY_LOG_CATEGORY.ITEM) {
    const itemId = meta.itemId || 'item';
    const itemLabel = toTitleCase(itemId);
    if ([ACTIVITY_LOG_ACTIONS.RECEIVE_ITEM, ACTIVITY_LOG_ACTIONS.GIVE_ITEM].includes(log.action)) return `Received ${log.amount} × ${itemLabel}${source ? ` · ${toTitleCase(source)}` : ''}`;
    if (log.action === ACTIVITY_LOG_ACTIONS.CONSUME_ITEM) return `Used ${log.amount} × ${itemLabel}`;
    if (log.action === ACTIVITY_LOG_ACTIONS.SHOP_PURCHASE) return `Shop purchase${amt ? ` · ${amt} drachma` : ''}`;
  }
  if (log.category === ACTIVITY_LOG_CATEGORY.STAT) {
    if (log.action === ACTIVITY_LOG_ACTIONS.APPROVE_TRAINING) {
      const date = meta.date ? `${formatAppDate(meta.date)}` : '';
      return `Training task of ${date} is approved · ${amt} TP earned`;
    }
    if (log.action === ACTIVITY_LOG_ACTIONS.STAT_UPGRADE || log.action === ACTIVITY_LOG_ACTIONS.SKILL_UPGRADE) return `Upgraded ${toTitleCase(meta.stat || 'stat')} +${amt}`;
    if (log.action === ACTIVITY_LOG_ACTIONS.ADD_TRAINING_POINTS) return `+${amt} Training Points · ${toTitleCase(source)}`;
  }
  if (log.category === ACTIVITY_LOG_CATEGORY.EQUIPMENT) {
    const outcome = String(meta.outcome || '').toLowerCase();
    const passed = outcome === EQUIPMENT_UPGRADE_OUTCOME.SUCCESS || outcome === EQUIPMENT_UPGRADE_OUTCOME.PASS;
    return `Equipment upgrade · ${passed ? 'Pass' : 'Fail'} · ${meta.equipmentName || ''}`;
  }
  return `${log.action.replace(/_/g, ' ')}${amt ? ` · ${amt}` : ''}`;
}

type EditDraft = EditableLogFields;

export default function ActivityLog() {
  const { role, user } = useAuth();
  const isDev = role === ROLE.DEVELOPER;

  const [logs, setLogs] = useState<ActivityLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [characterInput, setCharacterInput] = useState('');
  const [activeCharFilter, setActiveCharFilter] = useState('');

  const [editingLog, setEditingLog] = useState<ActivityLogType | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteLog, setPendingDeleteLog] = useState<ActivityLogType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadLogs = async (charId?: string) => {
    setLoading(true);
    setLoadError('');
    try {
      const [data, acceptedClaims] = await Promise.all([
        charId ? fetchActivityLogsForCharacter(charId, 300) : fetchActivityLogs(300),
        charId ? fetchAcceptedClaimsForCharacter(charId, 14) : Promise.resolve([]),
      ]);
      const sorted = [...data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      if (charId && acceptedClaims.length > 0) {
        const loggedGiftDates = new Set(
          sorted
            .filter(l => l.category === ACTIVITY_LOG_CATEGORY.DRACHMA && (l.metadata as Record<string, any>)?.source === ACTIVITY_LOG_SOURCES.DAILY_GIFT)
            .map(l => getAppDateString(l.createdAt))
        );
        const syntheticClaims = acceptedClaims
          .filter(c => !loggedGiftDates.has(c.date))
          .map(c => (
            {
              id: `daily-gift-${charId}-${c.date}`,
              category: ACTIVITY_LOG_CATEGORY.DRACHMA,
              action: ACTIVITY_LOG_ACTIONS.AWARD,
              characterId: charId,
              performedBy: charId,
              amount: c.amount,
              metadata: { source: ACTIVITY_LOG_SOURCES.DAILY_GIFT, syntheticFromClaim: true },
              createdAt: `${c.date}T05:00:00.000Z`,
            }));
        setLogs([...sorted, ...syntheticClaims].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } else {
        setLogs(sorted);
      }
    } catch {
      setLoadError('Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAllCharacters(user).then(setAllCharacters);
    loadLogs();
  }, []);

  const applyCharFilter = (_characterInput: string) => {
    const trimmed = _characterInput.trim();
    setActiveCharFilter(trimmed);
    loadLogs(trimmed || undefined);
  };

  const clearCharFilter = () => {
    setCharacterInput('');
    setActiveCharFilter('');
    loadLogs();
  };

  const filtered = (categoryFilter === 'all' ? logs : logs.filter(l => l.category === categoryFilter));

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

  const cancelEdit = () => { setEditingLog(null); setEditDraft(null); };

  const patch = (fields: Partial<EditDraft>) =>
    setEditDraft(prev => prev ? { ...prev, ...fields } : prev);

  const confirmDelete = async () => {
    if (!pendingDeleteLog?.id) return;
    setIsDeleting(true);
    try {
      await deleteActivityLog(pendingDeleteLog.id);
      setLogs(prev => prev.filter(l => l.id !== pendingDeleteLog.id));
    } catch {
      setLoadError('Failed to delete log entry.');
    } finally {
      setIsDeleting(false);
      setPendingDeleteLog(null);
    }
  };

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
        l.id === editingLog.id ? { ...l, ...fields, editedAt: now, editedBy: user.characterId } : l
      ));
      setEditingLog(null);
      setEditDraft(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <h2 className="activity-log-title">Activity Log</h2>
        <p className="activity-log-desc">
          Audit trail for drachma, item, equipment, stat, and action events
          {activeCharFilter && <> — filtered to <strong>{activeCharFilter}</strong></>}
        </p>
      </div>

      {/* Category filter pills */}
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

      {/* Character filter row */}
      <div className="al__char-filter">
        <Dropdown
          className="al__char-filter-dropdown"
          options={allCharacters.map(c => ({ label: c.nicknameEng || toTitleCase(c.characterId), value: c.characterId }))}
          placeholder="Filter by character"
          value={characterInput}
          onChange={(value) => {
            setCharacterInput(value);
            applyCharFilter(value);
          }}
          disabled={loading}
        />
        <button
          className="al__char-filter-btn al__char-filter-btn--clear"
          onClick={clearCharFilter}
          disabled={loading || !activeCharFilter || activeCharFilter === ''}
        >
          <Close width={14} height={14} strokeWidth={2.5} />
        </button>
        <button
          className="al__char-filter-btn al__char-filter-btn--refresh"
          onClick={() => loadLogs(activeCharFilter || undefined)}
          disabled={loading}
        >
          <Refresh width={13} height={13} />
        </button>
      </div>

      {loadError && <p className="al__error">{loadError}</p>}

      {/* Card list */}
      <div className="al__feed">
        {loading && (
          <div className="al__loading"><div className="loader-spinner" /><span>Loading…</span></div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="al__empty">No activity records found.</div>
        )}
        {!loading && filtered.map(log => {
          const meta = (log.metadata as Record<string, any>) || {};
          const source = String(meta.source || '');
          return (
            <article key={log.id ?? log.createdAt} className={`al__card al__card--${log.category}`}>
              <div className="al__card-body">
                <div className="al__card-meta">
                  <span className="al__card-char">{log.characterId}</span>
                  <span className={`al__badge al__badge--${log.category}`}>{log.category}</span>
                  {log.performedBy && log.performedBy !== log.characterId && (
                    <span className="al__card-by">by {log.performedBy}</span>
                  )}
                  <span className="al__card-time">{formatDate(log.createdAt)}</span>
                  {log.editedAt && <span className="al__card-edited">edited</span>}
                </div>
                <div className="al__card-desc">{describeLog(log)}</div>
                {(source || log.action) && (
                  <div className="al__card-sub">
                    <span className="al__card-action">{toTitleCase(log.action || '')}</span>
                    {source && <span className="al__card-source">· {toTitleCase(source)}</span>}
                    {log.amount != null && <span className="al__card-amount">· {log.amount.toLocaleString()}</span>}
                  </div>
                )}
                {log.note && <div className="al__card-note">{log.note}</div>}
              </div>
              {isDev && (
                <div className="al__card-actions">
                  <button className="al__icon-btn" onClick={() => startEdit(log)} title="Edit"><Pencil width={13} height={13} /></button>
                  <button className="al__icon-btn al__icon-btn--danger" onClick={() => setPendingDeleteLog(log)} title="Delete"><Trash width={13} height={13} /></button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Delete confirmation */}
      {isDev && pendingDeleteLog && (
        <ConfirmModal
          title="Delete Log Entry"
          message={`Delete this log entry from ${formatDate(pendingDeleteLog.createdAt)}? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteLog(null)}
        />
      )}

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
              <Input label="Action" value={editDraft.action} onChange={e => patch({ action: e })} />
              <Input label="Character ID" value={editDraft.characterId} onChange={e => patch({ characterId: e })} />
              <Input label="Performed By" value={editDraft.performedBy} onChange={e => patch({ performedBy: e })} />
              <Input label="Amount" type="number" value={editDraft.amount?.toString() ?? ''} onChange={e => patch({ amount: e === '' ? undefined : Number(e) })} />
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
