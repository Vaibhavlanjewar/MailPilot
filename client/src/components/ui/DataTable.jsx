import { cn } from '../../utils/cn';

/**
 * @typedef {{ key: string, header: string, className?: string, render?: (row: object) => React.ReactNode }} Column
 */

/**
 * @param {{
 *   columns: Column[],
 *   rows: object[],
 *   emptyMessage?: string,
 *   className?: string,
 *   loading?: boolean,
 * }} props
 */
export default function DataTable({
  columns,
  rows,
  emptyMessage = 'No data yet.',
  className,
  loading,
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-app bg-app-surface shadow-card',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-surface-border text-left text-sm">
          <thead className="bg-surface-muted/80">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 font-semibold text-app-muted sm:px-5',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-app-surface">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 sm:px-5">
                      <div className="h-4 rounded bg-[color:var(--surface-border)]/70" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-app-muted sm:px-5"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  className="transition-colors hover:bg-app-muted"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-app sm:px-5',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
