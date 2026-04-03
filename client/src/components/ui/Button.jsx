import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-app-gradient text-white shadow-app-soft border border-transparent hover:-translate-y-0.5 hover:brightness-110',
  secondary:
    'bg-transparent text-[var(--primary)] border border-[color:var(--primary)] hover:bg-[color:rgba(var(--primary-rgb),0.08)]',
  danger:
    'bg-[color:rgba(var(--primary-rgb),0.1)] text-[var(--primary)] border border-[color:rgba(var(--primary-rgb),0.28)] hover:bg-[color:rgba(var(--primary-rgb),0.16)]',
  ghost: 'text-app-muted hover:bg-app-muted border border-transparent',
};

const baseClass =
  'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]';

export function LinkButton({
  to,
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}) {
  return (
    <Link
      to={to}
      className={cn(
        baseClass,
        variants[variant],
        size === 'sm' && 'gap-1.5 px-3 py-1.5 text-sm',
        size === 'md' && 'gap-2 px-4 py-2.5 text-sm',
        size === 'lg' && 'gap-2 px-5 py-3 text-base',
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export default function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        baseClass,
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        size === 'sm' && 'gap-1.5 px-3 py-1.5 text-sm',
        size === 'md' && 'gap-2 px-4 py-2.5 text-sm',
        size === 'lg' && 'gap-2 px-5 py-3 text-base',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
