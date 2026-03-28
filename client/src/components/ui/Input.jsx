import { cn } from '../../utils/cn';

export function Label({ children, htmlFor, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('mb-1.5 block text-sm font-medium text-slate-700', className)}
    >
      {children}
    </label>
  );
}

export default function Input({ className, id, ...props }) {
  return (
    <input
      id={id}
      className={cn(
        'w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
        className
      )}
      {...props}
    />
  );
}

export function TextArea({ className, id, rows = 4, ...props }) {
  return (
    <textarea
      id={id}
      rows={rows}
      className={cn(
        'w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, id, children, ...props }) {
  return (
    <select
      id={id}
      className={cn(
        'w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
