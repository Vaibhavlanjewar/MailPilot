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
        'overflow-hidden rounded-xl border border-surface-border bg-white shadow-card dark:border-slate-700 dark:bg-slate-900',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-surface-border text-left text-sm dark:divide-slate-700">
          <thead className="bg-surface-muted/80 dark:bg-slate-800/80">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 font-semibold text-slate-600 dark:text-slate-300 sm:px-5',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-white dark:divide-slate-700 dark:bg-slate-900">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 sm:px-5">
                      <div className="h-4 rounded bg-slate-200 dark:bg-slate-700" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-slate-500 dark:text-slate-400 sm:px-5"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-slate-800 dark:text-slate-200 sm:px-5',
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
