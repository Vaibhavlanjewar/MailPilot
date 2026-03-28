import { cn } from '../../utils/cn';

export default function LoadingSpinner({ className, label = 'Loading' }) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
