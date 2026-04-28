import React, { useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { firestore } from '../../../../../../firebase';
import './FirestoreManager.scss';
import { Dropdown, Input } from '../../../../../../components/Form';
import ConfirmModal from '../../../../../../components/ConfirmModal/ConfirmModal';
import { FIRESTORE_COLLECTIONS, FireStoreCollections } from '../../../../../../constants/fireStoreCollections';
import Table from '../../../../../../components/Table/Table';
import ChevronDown from '../../../../../../icons/ChevronDown';
import Pencil from '../../../../../../icons/Pencil';
import Save from '../../../ItemManagement/icons/Save';
import Close from '../../../../../../icons/Close';
import Trash from '../../../../../../icons/Trash';

type FirestoreDoc = {
  id: string;
  data: Record<string, any>;
};

function previewFor(obj: any) {
  if (!obj || typeof obj !== 'object') return String(obj ?? '');
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

export default function FirestoreManager() {
  const [collectionName, setCollectionName] = useState('');
  const [docs, setDocs] = useState<FirestoreDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<FirestoreDoc | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadCollection = async (_collectionName: string) => {
    if (!_collectionName) return;
    setLoading(true);
    setError(null);
    setDocs([]);
    setSelectedDoc(null);
    setEditing(false);
    setEditDraft({});
    try {
      const colRef = collection(firestore, _collectionName);
      const snap = await getDocs(colRef);
      const items: FirestoreDoc[] = [];
      snap.forEach((d) => items.push({ id: d.id, data: d.data() as Record<string, any> }));
      setDocs(items);
    } catch (err) {
      console.error('Failed to load collection', err);
      setError('Failed to load collection');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionChange = (nextCollection: string) => {
    setCollectionName(nextCollection);
    setLeftCollapsed(false);
    loadCollection(nextCollection);
  };

  const filteredDocs = useMemo(() => {
    if (!filterText) return docs;
    const q = filterText.toLowerCase();
    return docs.filter((d) => {
      return String(d.id).toLowerCase().includes(q) || String(previewFor(d.data)).toLowerCase().includes(q);
    });
  }, [docs, filterText]);

  const selectedFields = useMemo(() => {
    if (!selectedDoc) return [];
    return Object.entries(selectedDoc.data || {});
  }, [selectedDoc]);

  const editableFields = useMemo(() => {
    if (!selectedDoc) return [];
    return Object.entries(selectedDoc.data || {});
  }, [selectedDoc]);

  const startEdit = () => {
    if (!selectedDoc) return;

    const draft = Object.fromEntries(
      Object.entries(selectedDoc.data || {}).map(([key, value]) => [key, stringifyValue(value)])
    );
    setEditDraft(draft);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditDraft({});
  };

  const saveEdit = async () => {
    if (!selectedDoc || !collectionName) return;

    setSaveLoading(true);
    setError(null);

    try {
      const original = selectedDoc.data || {};
      const parsed = Object.fromEntries(
        Object.entries(editDraft).map(([key, value]) => [key, coerceValue(value, original[key])])
      );

      const dref = doc(firestore, collectionName, selectedDoc.id);
      await setDoc(dref, parsed);

      setDocs((prev) => prev.map((item) => (item.id === selectedDoc.id ? { id: selectedDoc.id, data: parsed } : item)));
      setSelectedDoc({ id: selectedDoc.id, data: parsed });
      setEditing(false);
      setEditDraft({});
    } catch (err) {
      console.error('Failed to save doc', err);
      setError((err as Error)?.message || 'Failed to save document');
    } finally {
      setSaveLoading(false);
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, collectionName, id));
      setDocs((s) => s.filter((x) => x.id !== id));
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
        setEditing(false);
        setEditDraft({});
      }
    } catch (err) {
      console.error('Failed to delete doc', err);
      setError('Failed to delete document');
    }
  };

  const requestDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const tableColumns = useMemo(() => [
    { key: 'id', label: 'ID', width: '35%' },
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
    <div className="firestore-manager">
      <div className="firestore-manager__controls">
        <Dropdown
          className="firestore-manager__dropdown"
          placeholder="Select collection"
          value={collectionName}
          onChange={handleCollectionChange}
          options={Object.keys(FIRESTORE_COLLECTIONS).map((key) => ({
            label: FIRESTORE_COLLECTIONS[key as FireStoreCollections],
            value: FIRESTORE_COLLECTIONS[key as FireStoreCollections],
          }))}
        />
      </div>

      <div className="firestore-manager__content">
        {loading ? (
          <div className="firestore-manager__loading">Loading...</div>
        ) : error ? (
          <div className="firestore-manager__error">{error}</div>
        ) : !collectionName ? (
          <div className="firestore-manager__no-data">No collection selected</div>
        ) : (
          <>
            <div className={`firestore-manager__left${leftCollapsed ? ' firestore-manager__left--collapsed' : ''}`}>
              <div className="firestore-manager__left-header">
                <Input
                  className="firestore-manager__filter"
                  placeholder="Filter by id or preview"
                  value={filterText}
                  onChange={(text) => setFilterText(text)}
                />
                <button
                  className="firestore-manager__collapse-btn"
                  onClick={() => setLeftCollapsed((v) => !v)}
                  data-tooltip={leftCollapsed ? 'Expand list' : 'Collapse list'}
                  data-tooltip-pos="left"
                >
                  {leftCollapsed ? <ChevronDown /> : <ChevronDown style={{ transform: 'rotate(180deg)' }} />}
                </button>
              </div>

              <div className="firestore-manager__table-wrap">
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
                  <div className="firestore-manager__no-data firestore-manager__no-data--list">
                    No documents
                  </div>
                )}
              </div>
            </div>

            <div className={`firestore-manager__right${!selectedDoc ? ' firestore-manager__right--empty' : ''}`}>
              {selectedDoc && (
                <div className="firestore-manager__detail-header">
                  <span className="firestore-manager__doc-id">{selectedDoc.id}</span>
                  {!editing && (
                    <div className="firestore-manager__actions">
                      <button className="firestore-manager__btn firestore-manager__btn--edit" onClick={startEdit}>
                        <Pencil />
                      </button>
                      <button className="firestore-manager__btn firestore-manager__btn--danger" onClick={() => requestDelete(selectedDoc.id)}>
                        <Trash />
                      </button>
                    </div>
                  )}
                  {editing && (
                    <div className="firestore-manager__actions">
                      <button className="firestore-manager__btn firestore-manager__btn--save" onClick={saveEdit} disabled={saveLoading}>
                        <Save />
                      </button>
                      <button className="firestore-manager__btn firestore-manager__btn--close" onClick={cancelEdit} disabled={saveLoading}>
                        <Close />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!selectedDoc && (
                <div className="firestore-manager__right-no-data">Select a document to view details</div>
              )}

              {selectedDoc && !editing && (
                <div className="firestore-manager__fields">
                  {selectedFields.map(([key, value]) => (
                    <div key={key} className="firestore-manager__field">
                      <span className="firestore-manager__field-key">{key}</span>
                      <span className="firestore-manager__field-value">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedDoc && editing && (
                <div className="firestore-manager__editor-panel">
                  <div className="firestore-manager__editor-grid">
                    {editableFields.map(([key, value]) => {
                      const isLong = stringifyValue(value).length > 120 || stringifyValue(value).includes('\n');

                      return (
                        <div key={key} className={`firestore-manager__editor-field ${isLong ? 'firestore-manager__editor-field--wide' : ''}`}>
                          <span className="firestore-manager__editor-field-label">{key}</span>
                          {isLong || typeof value === 'object' ? (
                            <textarea
                              className="firestore-manager__editor-textarea"
                              value={editDraft[key] ?? ''}
                              rows={4}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                            />
                          ) : (
                            <Input
                              className="firestore-manager__editor-input"
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

      {showDeleteConfirm && pendingDeleteId && (
        <ConfirmModal
          title="Delete document?"
          message={`Delete document ${pendingDeleteId} in ${collectionName}? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger
          onConfirm={async () => {
            await deleteDocument(pendingDeleteId);
            setShowDeleteConfirm(false);
            setPendingDeleteId(null);
          }}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setPendingDeleteId(null);
          }}
        />
      )}
    </div>
  );
}
