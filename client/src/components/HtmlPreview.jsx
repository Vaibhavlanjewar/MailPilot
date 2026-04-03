import { cn } from '../utils/cn';

/**
 * Toggle between editing raw HTML and rendered preview.
 * @param {{ value: 'edit' | 'preview', onChange: (v: 'edit' | 'preview') => void, className?: string }} props
 */
export function HtmlViewModeToggle({ value, onChange, className }) {
  const base =
    'rounded-md max-sm:flex-1 px-3 py-1.5 text-sm font-medium transition-colors';
  const active =
    'bg-app-surface text-app shadow-app-soft';
  const idle = 'text-app-muted hover:text-app';
  return (
    <div
      className={cn(
        'inline-flex max-sm:w-full gap-0.5 rounded-xl border border-surface-border bg-app-muted p-0.5',
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
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5;margin:12px;color:#111827;word-wrap:break-word;}</style></head><body>${trimmed}</body></html>`
    : '';

  if (!srcDoc) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-surface-border bg-app-muted p-8 text-center text-sm text-app-muted',
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
        'w-full rounded-xl border border-surface-border bg-app-surface shadow-app-soft',
        className
      )}
      style={{ minHeight }}
    />
  );
}
