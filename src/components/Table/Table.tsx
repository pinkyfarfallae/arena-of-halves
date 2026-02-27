import './Table.scss';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Column<T extends Record<string, any>> {
  key: keyof T & string;
  label: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

export interface Action<T extends Record<string, any>> {
  label: string | ((row: T) => React.ReactNode);
  onClick: (row: T) => void;
}

interface Props<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  actions?: Action<T>[];
  headerColor?: string;
  loading?: boolean;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Table<T extends Record<string, any>>({
  columns, data, rowKey, actions, headerColor, loading,
}: Props<T>) {
  const hasActions = actions && actions.length > 0;

  if (loading) return <div className="at__loading">Loading…</div>;

  return (
    <div className="at">
      <table className="at__table">
        <thead style={headerColor ? { background: headerColor } : undefined}>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
            {hasActions && <th className="at__th-actions" />}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (hasActions ? 1 : 0)}
                className="at__empty"
              >
                No data
              </td>
            </tr>
          ) : data.map(row => (
            <tr key={rowKey(row)}>
              {columns.map(c => (
                <td key={c.key} data-label={c.label} style={c.width ? { width: c.width } : undefined}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '')}
                </td>
              ))}
              {hasActions && (
                <td data-label="Actions">
                  <div className="at__actions">
                    {actions.map((a, i) => (
                      <button
                        key={i}
                        className="at__btn at__btn--action"
                        onClick={() => a.onClick(row)}
                        onMouseOver={(e) => { e.stopPropagation(); e.preventDefault(); }}
                      >
                        {typeof a.label === 'function' ? a.label(row) : a.label}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
