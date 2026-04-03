import { cn } from '../../utils/cn';

const styles = {
  completed: 'bg-[color:rgba(var(--secondary-rgb),0.12)] text-[var(--secondary)] ring-[color:rgba(var(--secondary-rgb),0.2)]',
  sending: 'bg-[color:rgba(var(--secondary-rgb),0.12)] text-[var(--secondary)] ring-[color:rgba(var(--secondary-rgb),0.2)]',
  scheduled: 'bg-[color:rgba(var(--primary-rgb),0.12)] text-[var(--primary)] ring-[color:rgba(var(--primary-rgb),0.2)]',
  draft: 'bg-[color:var(--surface)] text-app-muted ring-[color:var(--surface-border)]',
  failed: 'bg-[color:rgba(var(--primary-rgb),0.12)] text-[var(--primary)] ring-[color:rgba(var(--primary-rgb),0.2)]',
  active: 'bg-[color:rgba(var(--secondary-rgb),0.12)] text-[var(--secondary)] ring-[color:rgba(var(--secondary-rgb),0.2)]',
  inactive: 'bg-[color:var(--surface)] text-app-muted ring-[color:var(--surface-border)]',
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
