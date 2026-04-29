import React, { useMemo, useState } from 'react';
import './RealtimeManager.scss';
import { db } from '../../../../../../firebase';
import { ref, get, remove, set } from 'firebase/database';
import { Dropdown, Input } from '../../../../../../components/Form';
import ConfirmModal from '../../../../../../components/ConfirmModal/ConfirmModal';
import { FIREBASE_PATHS } from '../../../../../../constants/firebase';
import Table from '../../../../../../components/Table/Table';
import ChevronDown from '../../../../../../icons/ChevronDown';
import Pencil from '../../../../../../icons/Pencil';
import Save from '../../../ItemManagement/icons/Save';
import Close from '../../../../../../icons/Close';
import Trash from '../../../../../Shop/icons/Trash';
import { formatAppDateTime } from '../../../../../../utils/date';

type RealtimeDoc = {
  id: string;
  data: Record<string, any> | any;
};

function previewFor(obj: any) {
  if (obj == null) return '';
  if (typeof obj !== 'object') return String(obj);

  if (Array.isArray(obj)) {
    return `Array(${obj.length})`;
  }

  const keys = Object.keys(obj).slice(0, 3);
  return keys.map((k) => `${k}: ${String(obj[k])}`).join(' | ');
}

function stringifyValue(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }
  return String(value);
}

function coerceValue(raw: string, original: any) {
  const trimmed = raw.trim();

  if (original == null) return raw;

  if (typeof original === 'number') {
    if (trimmed === '') return '';
    const num = Number(trimmed);
    if (Number.isNaN(num)) throw new Error(`Expected number for value "${raw}"`);
    return num;
  }

  if (typeof original === 'boolean') {
    if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
    throw new Error(`Expected boolean for value "${raw}"`);
  }

  if (typeof original === 'object') {
    if (trimmed === '') {
      return Array.isArray(original) ? [] : {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('Nested fields must stay valid JSON');
    }
  }

  return raw;
}

function formatUnixDateTime(value: any) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || Number.isNaN(num)) return String(value);

  const ms = num < 1_000_000_000_000 ? num * 1000 : num;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return String(value);

  return formatAppDateTime(date);
}

function formatFieldValue(key: string, value: any) {
  if (key === 'createdAt') {
    return formatUnixDateTime(value);
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export default function RealtimeManager() {
  const [rootName, setRootName] = useState('');
  const [rootData, setRootData] = useState<Record<string, any> | any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<RealtimeDoc | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeletePath, setPendingDeletePath] = useState('');

  const loadRoot = async (nextRoot: string) => {
    if (!nextRoot) return;
    setLoading(true);
    setError(null);
    setRootData(null);
    setSelectedDoc(null);
    setEditing(false);
    setEditDraft({});

    try {
      const snap = await get(ref(db, nextRoot));
      setRootData(snap.exists() ? snap.val() : null);
    } catch (err: any) {
      console.error('Failed to load RTDB root', err);
      setError(err?.message || String(err) || 'Failed to load collection');
      setRootData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRootChange = (nextRoot: string) => {
    setRootName(nextRoot);
    setFilterText('');
    setLeftCollapsed(false);
    loadRoot(nextRoot);
  };

  const isObj = rootData !== null && typeof rootData === 'object';
  const docs = useMemo(() => {
    if (!isObj) return [];
    return Object.entries(rootData as Record<string, any>).map(([id, data]) => ({ id, data }));
  }, [isObj, rootData]);

  const filteredDocs = useMemo(() => {
    if (!filterText) return docs;
    const q = filterText.toLowerCase();
    return docs.filter((d) => {
      return String(d.id).toLowerCase().includes(q) || String(previewFor(d.data)).toLowerCase().includes(q);
    });
  }, [docs, filterText]);

  const selectedValue = selectedDoc?.data ?? null;
  const selectedPath = selectedDoc ? `${rootName}/${selectedDoc.id}` : rootName;

  const fields = useMemo(() => {
    if (!selectedDoc) return [];
    if (selectedValue !== null && typeof selectedValue === 'object' && !Array.isArray(selectedValue)) {
      return Object.entries(selectedValue);
    }
    return [['value', selectedValue] as const];
  }, [selectedDoc, selectedValue]);

  const startEdit = () => {
    if (!selectedDoc) return;
    const draft = Object.fromEntries(
      fields.map(([key, value]) => [key, stringifyValue(value)])
    );
    setEditDraft(draft);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditDraft({});
  };

  const saveEdit = async () => {
    if (!selectedDoc || !rootName) return;

    setSaveLoading(true);
    setError(null);

    try {
      const original = selectedValue;
      const parsed = Object.fromEntries(
        fields.map(([key, value]) => [key, coerceValue(editDraft[key] ?? '', key === 'value' ? original : (original as any)?.[key])])
      );

      const nextValue = fields.length === 1 && fields[0][0] === 'value'
        ? parsed.value
        : parsed;

      await set(ref(db, selectedPath), nextValue);

      setRootData((prev: Record<string, any> | null) => {
        if (!prev || typeof prev !== 'object') return prev;
        return { ...(prev as Record<string, any>), [selectedDoc.id]: nextValue };
      });
      setSelectedDoc({ id: selectedDoc.id, data: nextValue });
      setEditing(false);
      setEditDraft({});
    } catch (err: any) {
      console.error('Failed to save RTDB node', err);
      setError(err?.message || String(err) || 'Failed to save node');
    } finally {
      setSaveLoading(false);
    }
  };

  const deleteSelected = async (pathToDelete: string, docId: string) => {
    try {
      await remove(ref(db, pathToDelete));
      setRootData((prev: Record<string, any>) => {
        if (!prev || typeof prev !== 'object') return null;
        const next = { ...(prev as Record<string, any>) };
        delete next[docId];
        return Object.keys(next).length ? next : null;
      });
      setSelectedDoc(null);
      setEditing(false);
      setEditDraft({});
    } catch (err: any) {
      console.error('Failed to delete RTDB node', err);
      setError(err?.message || String(err) || 'Failed to delete node');
    }
  };

  const requestDelete = () => {
    if (!selectedDoc) return;
    setPendingDeletePath(selectedPath);
    setShowDeleteConfirm(true);
  };

  const tableColumns = useMemo(() => [
    { key: 'id', label: 'Key', width: '35%' },
    { key: 'preview', label: 'Preview' },
  ], []);

  const tableData = useMemo(() => {
    return filteredDocs.map((d) => ({
      id: d.id,
      preview: previewFor(d.data),
      __raw: d,
    }));
  }, [filteredDocs]);

  return (
    <div className="realtime-manager">
      <div className="realtime-manager__controls">
        <Dropdown
          className="realtime-manager__dropdown"
          placeholder="Select root"
          value={rootName}
          onChange={handleRootChange}
          options={[
            { label: 'Arenas', value: FIREBASE_PATHS.ARENAS },
            { label: 'Training Quotas', value: FIREBASE_PATHS.TRAINING_QUOTAS },
          ]}
        />
      </div>

      <div className="realtime-manager__content">
        {loading ? (
          <div className="realtime-manager__loading">Loading...</div>
        ) : error ? (
          <div className="realtime-manager__error">{error}</div>
        ) : !rootName ? (
          <div className="realtime-manager__no-data">No collection selected</div>
        ) : (
          <>
            <div className={`realtime-manager__left${leftCollapsed ? ' realtime-manager__left--collapsed' : ''}`}>
              <div className="realtime-manager__left-header">
                <Input
                  className="realtime-manager__filter"
                  placeholder="Filter by key or preview"
                  value={filterText}
                  onChange={(text) => setFilterText(text)}
                />
                <button
                  className="realtime-manager__collapse-btn"
                  onClick={() => setLeftCollapsed((v) => !v)}
                  data-tooltip={leftCollapsed ? 'Expand list' : 'Collapse list'}
                  data-tooltip-pos="left"
                >
                  {leftCollapsed ? <ChevronDown /> : <ChevronDown style={{ transform: 'rotate(180deg)' }} />}
                </button>
              </div>

              <div className="realtime-manager__table-wrap">
                {tableData.length > 0 ? (
                  <Table
                    columns={tableColumns as any}
                    data={tableData as any}
                    rowKey={(row: any) => row.id}
                    loading={false}
                    hideHeaders={false}
                    selectedRowIdx={selectedDoc ? filteredDocs.findIndex((d) => d.id === selectedDoc.id) : -1}
                    onRowClick={(row: any) => {
                      const found = filteredDocs.find((d) => d.id === row.id);
                      if (found) {
                        setSelectedDoc(found);
                        setEditing(false);
                        setEditDraft({});
                        setLeftCollapsed(true);
                      }
                    }}
                  />
                ) : (
                  <div className="realtime-manager__no-data realtime-manager__no-data">No items</div>
                )}
              </div>
            </div>

            <div className={`realtime-manager__right${!selectedDoc ? ' realtime-manager__right--empty' : ''}`}>
              {selectedDoc && (
                <div className="realtime-manager__detail-header">
                  <span className="realtime-manager__doc-id">{selectedDoc.id}</span>
                  {!editing && (
                    <div className="realtime-manager__actions">
                      <button className="realtime-manager__btn realtime-manager__btn--edit" onClick={startEdit}>
                        <Pencil />
                      </button>
                      <button className="realtime-manager__btn realtime-manager__btn--danger" onClick={requestDelete}>
                        <Trash />
                      </button>
                    </div>
                  )}
                  {editing && (
                    <div className="realtime-manager__actions">
                      <button className="realtime-manager__btn realtime-manager__btn--save" onClick={saveEdit} disabled={saveLoading}>
                        <Save />
                      </button>
                      <button className="realtime-manager__btn realtime-manager__btn--close" onClick={cancelEdit} disabled={saveLoading}>
                        <Close />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!selectedDoc && (
                <div className="realtime-manager__right-no-data">Select a document to view details</div>
              )}

              {selectedDoc && !editing && (
                <div className="realtime-manager__fields">
                  {fields.map(([key, value]) => (
                    <div key={key} className="realtime-manager__field">
                      <span className="realtime-manager__field-key">{key}</span>
                      <span className="realtime-manager__field-value">
                        {formatFieldValue(key, value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedDoc && editing && (
                <div className="realtime-manager__editor-panel">
                  <div className="realtime-manager__editor-grid">
                    {fields.map(([key, value]) => {
                      const raw = stringifyValue(value);
                      const isLong = raw.length > 120 || raw.includes('\n');

                      return (
                        <div key={key} className={`realtime-manager__editor-field ${isLong ? 'realtime-manager__editor-field--wide' : ''}`}>
                          <span className="realtime-manager__editor-field-label">{key}</span>
                          {isLong || typeof value === 'object' ? (
                            <textarea
                              className="realtime-manager__editor-textarea"
                              value={editDraft[key] ?? ''}
                              rows={4}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                            />
                          ) : (
                            <Input
                              className="realtime-manager__editor-input"
                              value={editDraft[key] ?? ''}
                              onChange={(text) => setEditDraft((prev) => ({ ...prev, [key]: text }))}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && pendingDeletePath && (
        <ConfirmModal
          title="Delete document?"
          message={`Delete path ${pendingDeletePath}? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          onConfirm={async () => {
            if (!selectedDoc || !pendingDeletePath) return;
            await deleteSelected(pendingDeletePath, selectedDoc.id);
            setShowDeleteConfirm(false);
            setPendingDeletePath('');
          }}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setPendingDeletePath('');
          }}
        />
      )}
    </div>
  );
}
