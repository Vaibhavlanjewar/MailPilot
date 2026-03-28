import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 shadow-sm border border-transparent',
  secondary:
    'bg-white text-slate-700 border border-surface-border hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border border-transparent',
  ghost: 'text-slate-600 hover:bg-slate-100 border border-transparent',
};

const baseClass =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

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
