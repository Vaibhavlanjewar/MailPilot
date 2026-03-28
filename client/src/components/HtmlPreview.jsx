import { cn } from '../utils/cn';

/**
 * Toggle between editing raw HTML and rendered preview.
 * @param {{ value: 'edit' | 'preview', onChange: (v: 'edit' | 'preview') => void, className?: string }} props
 */
export function HtmlViewModeToggle({ value, onChange, className }) {
  const base =
    'rounded-md max-sm:flex-1 px-3 py-1.5 text-sm font-medium transition-colors';
  const active =
    'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100';
  const idle = 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100';
  return (
    <div
      className={cn(
        'inline-flex max-sm:w-full gap-0.5 rounded-lg border border-surface-border bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-900',
        className
      )}
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'edit'}
        className={cn(base, value === 'edit' ? active : idle)}
        onClick={() => onChange('edit')}
      >
        Edit HTML
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'preview'}
        className={cn(base, value === 'preview' ? active : idle)}
        onClick={() => onChange('preview')}
      >
        Preview
      </button>
    </div>
  );
}

/**
 * Sandboxed iframe preview of user-authored HTML (no scripts).
 */
export default function HtmlPreview({
  html,
  className,
  minHeight = '240px',
  emptyMessage = 'Nothing to preview yet.',
}) {
  const trimmed = html?.trim() ?? '';
  const srcDoc = trimmed
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5;margin:12px;color:#0f172a;word-wrap:break-word;}</style></head><body>${trimmed}</body></html>`
    : '';

  if (!srcDoc) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-surface-border bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <iframe
      title="HTML preview"
      sandbox=""
      srcDoc={srcDoc}
      className={cn(
        'w-full rounded-lg border border-surface-border bg-white shadow-sm dark:border-slate-600 dark:bg-slate-950',
        className
      )}
      style={{ minHeight }}
    />
  );
}
