import React, { useMemo, useState } from 'react';
import './SheetManager.scss';
import { csvUrl, GID, APPS_SCRIPT_URL } from '../../../../../../constants/sheets';
import { patchCharacter } from '../../../../../../data/characters';
import { ACTIONS } from '../../../../../../constants/action';
import { splitCSVRows, parseCSVLine } from '../../../../../../utils/csv';
import { Dropdown, Input } from '../../../../../../components/Form';
import { toTitleCase } from '../../../../../../utils/formatText';
import ChevronDown from '../../../../../../icons/ChevronDown';
import Table from '../../../../../../components/Table/Table';
import Pencil from '../../../../../../icons/Pencil';
import Save from '../../../ItemManagement/icons/Save';
import Close from '../../../../../../icons/Close';

function parseCsv(text: string): { headers: string[]; data: any[] } {
  const rows = splitCSVRows(text);
  if (rows.length === 0) return { headers: [], data: [] };
  const headers = parseCSVLine(rows[0]);
  const data = rows.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { headers, data };
}

export default function SheetManager() {
  const [sheetKey, setSheetKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[]; data: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [selectedRow, setSelectedRow] = useState<{ idx: number; row: any } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const loadSheet = async (key: string) => {
    setLoading(true);
    setError(null);
    setCsvData(null);
    setSelectedRow(null);
    try {
      const gid = (GID as any)[key];
      const resp = await fetch(csvUrl(gid));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      setCsvData(parseCsv(text));
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = (key: string) => {
    setSheetKey(key);
    setSelectedRow(null);
    setEditing(false);
    setFilterText('');
    loadSheet(key);
    setLeftCollapsed(false);
  };

  const startEdit = () => {
    if (!selectedRow) return;
    const draft = Object.fromEntries(
      Object.entries(selectedRow.row).map(([key, value]) => [key, value == null ? '' : String(value)])
    );
    setEditDraft(draft);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditDraft({});
  };

  const saveEdit = async () => {
    if (!selectedRow || !csvData) return;
    setSaveLoading(true);
    setError(null);
    try {
      const nextRow = { ...editDraft };

      if (sheetKey === 'CHARACTER') {
        const { headers } = csvData;
        const idHeader = headers.find(h => h.toLowerCase() === 'characterid')
          ?? headers.find(h => h.toLowerCase() === 'id')
          ?? '';
        const characterId = nextRow[idHeader] || nextRow.characterId || nextRow.characterid;
        if (!characterId) throw new Error('characterId field not found in row');
        const fields: Record<string, string> = {};
        Object.keys(nextRow).forEach((k) => {
          if (k === idHeader || k.toLowerCase() === 'characterid') return;
          fields[k] = String(nextRow[k] ?? '');
        });
        const ok = await patchCharacter(characterId, fields);
        if (!ok) throw new Error('Patch returned failure');
      } else {
        const parsed = Object.fromEntries(
          csvData.headers.map((header) => [header, nextRow[header] ?? ''])
        );
        const res = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action: ACTIONS.PATCH, sheet: sheetKey, row: parsed }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setCsvData((prev) => {
        if (!prev) return prev;
        const newData = [...prev.data];
        newData[selectedRow.idx] = nextRow;
        return { ...prev, data: newData };
      });
      setSelectedRow({ idx: selectedRow.idx, row: { ...selectedRow.row, ...nextRow } });
      setEditing(false);
      setEditDraft({});
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setSaveLoading(false);
    }
  };

  const editableHeaders = useMemo(() => {
    if (!csvData) return [];
    return csvData.headers;
  }, [csvData]);

  const PREVIEW_COLS = 4;
  const filteredRows = csvData
    ? csvData.data
      .map((row, idx) => ({ idx, row }))
      .filter(({ row }) => {
        if (!filterText) return true;
        const q = filterText.toLowerCase();
        return Object.values(row).some((v) => String(v).toLowerCase().includes(q));
      })
    : [];

  const columns = csvData
    ? csvData.headers.slice(0, PREVIEW_COLS).map((h) => ({ key: h, label: toTitleCase(h) }))
    : [];

  return (
    <div className="sheet-manager">
      <div className="sheet-manager__controls">
        <Dropdown
          value={sheetKey}
          className="sheet-manager__dropdown"
          placeholder="Select collection"
          onChange={(sheetKey) => {
            handleSheetChange(sheetKey);
          }}
          options={Object.keys(GID).map((key) => ({ label: toTitleCase(key), value: key }))}
        />
      </div>

      <div className="sheet-manager__content">
        {loading ? (
          <div className="sheet-manager__loading">Loading...</div>
        ) : error ? (
          <div className="sheet-manager__error">{error}</div>
        ) : !sheetKey || !csvData ? (
          <div className="sheet-manager__no-data">No collection selected</div>
        ) : (
          <>
            {/* ── Left: row list ── */}
            <div className={`sheet-manager__left${leftCollapsed ? ' sheet-manager__left--collapsed' : ''}`}>
              <div className="sheet-manager__left-header">
                <Input
                  className="sheet-manager__filter"
                  placeholder="Filter rows"
                  value={filterText}
                  onChange={(text) => setFilterText(text)}
                />
                <button
                  className="sheet-manager__btn"
                  onClick={() => setLeftCollapsed((v) => !v)}
                  data-tooltip={leftCollapsed ? 'Expand row list' : 'Collapse row list'}
                  data-tooltip-pos="left"
                >
                  {leftCollapsed ? <ChevronDown /> : <ChevronDown style={{ transform: 'rotate(180deg)' }} />}
                </button>
              </div>

              {filteredRows.length > 0 && (
                <div className="sheet-manager__table-wrap">
                  <Table
                    rowKey={(_row) => String(filteredRows.find(x => x.row === _row)?.idx ?? '')}
                    columns={columns}
                    data={filteredRows.map(({ row }) => row)}
                    onRowClick={(_row) => {
                      const found = filteredRows.find(x => x.row === _row);
                      if (found) {
                        setSelectedRow(found);
                        setEditing(false);
                        setLeftCollapsed(true);
                      }
                    }}
                    selectedRowIdx={filteredRows.findIndex(x => x.idx === selectedRow?.idx)}
                    loading={loading}
                  />
                </div>
              )}
            </div>

            {/* ── Right: detail / edit ── */}
            <div className={`sheet-manager__right${!selectedRow ? ' sheet-manager__right--empty' : ''}${!leftCollapsed ? ' sheet-manager__right--full' : ''}`}>
              {selectedRow && (
                <div className="sheet-manager__detail-header">
                  <h3>Row Detail</h3>
                  {!editing && (
                    <button
                      className="sheet-manager__btn sheet-manager__btn--edit"
                      onClick={startEdit}
                    >
                      <Pencil />
                    </button>
                  )}

                  {editing && (
                    <div className="sheet-manager__actions">
                      <button
                        className="sheet-manager__btn sheet-manager__btn--save"
                        onClick={saveEdit}
                        disabled={saveLoading}
                      >
                        <Save />
                      </button>
                      <button
                        className="sheet-manager__btn sheet-manager__btn--close"
                        onClick={cancelEdit}
                        disabled={saveLoading}
                      >
                        <Close />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!selectedRow && (
                <div className="sheet-manager__right-no-data">Select a row to view details</div>
              )}

              {selectedRow && !editing && (
                <div className="sheet-manager__fields">
                  {csvData!.headers.map((h) => (
                    <div key={h} className="sheet-manager__field">
                      <span className="sheet-manager__field-key">{h}</span>
                      <span className="sheet-manager__field-value">{selectedRow?.row[h]}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedRow && editing && (
                <div className="sheet-manager__editor-panel">
                  <div className="sheet-manager__editor-grid">
                    {editableHeaders.map((header) => {
                      const value = editDraft[header] ?? '';
                      const isLong = value.length > 120 || value.includes('\n');

                      return (
                        <div key={header} className={`sheet-manager__editor-field ${isLong ? 'sheet-manager__editor-field--wide' : ''}`}>
                          <span className="sheet-manager__editor-field-label">{header}</span>
                          {isLong ? (
                            <textarea
                              className="sheet-manager__editor-textarea"
                              value={value}
                              onChange={(e) => setEditDraft((prev) => ({ ...prev, [header]: e.target.value }))}
                              rows={4}
                            />
                          ) : (
                            <Input
                              className="sheet-manager__editor-input"
                              value={value}
                              onChange={(text) => setEditDraft((prev) => ({ ...prev, [header]: text }))}
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
    </div>
  );
}
