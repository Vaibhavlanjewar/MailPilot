import { cn } from '../../utils/cn';

const styles = {
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15',
  sending: 'bg-sky-50 text-sky-800 ring-sky-600/15',
  scheduled: 'bg-amber-50 text-amber-900 ring-amber-600/15',
  draft: 'bg-slate-100 text-slate-700 ring-slate-500/10',
  failed: 'bg-rose-50 text-rose-800 ring-rose-600/15',
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-500/10',
};

export default function Badge({ children, variant = 'draft', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        styles[variant] || styles.draft,
        className
      )}
    >
      {children}
    </span>
  );
}
