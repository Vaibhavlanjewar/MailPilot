import { cn } from '../../utils/cn';

const fieldBase =
  'w-full rounded-xl border border-app bg-app-surface px-3 py-2.5 text-sm text-app shadow-app-soft focus:border-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-app-focus';

const inputExtra = 'placeholder:text-app-muted';

export function Label({ children, htmlFor, className }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-1.5 block text-sm font-medium text-app',
        className
      )}
    >
      {children}
    </label>
  );
}

export default function Input({ className, id, ...props }) {
  return (
    <input
      id={id}
      className={cn(fieldBase, inputExtra, className)}
      {...props}
    />
  );
}

export function TextArea({ className, id, rows = 4, ...props }) {
  return (
    <textarea
      id={id}
      rows={rows}
      className={cn(fieldBase, inputExtra, className)}
      {...props}
    />
  );
}

export function Select({ className, id, children, ...props }) {
  return (
    <select
      id={id}
      className={cn(fieldBase, className)}
      {...props}
    >
      {children}
    </select>
  );
}
