import { cn } from '../../utils/cn';

export default function Card({ className, children, padding = true }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-border bg-white shadow-card',
        padding && 'p-5 sm:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}>
      <div>
        {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
