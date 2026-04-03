import Card from './Card';
import { cn } from '../../utils/cn';

export default function StatCard({ label, value, hint, trend, className }) {
  return (
    <Card className={cn('overflow-hidden', className)} padding>
      <p className="text-sm font-medium text-app-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-app sm:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-app-muted">{hint}</p>}
      {trend && (
        <p
          className={cn(
            'mt-3 inline-flex items-center gap-1 text-xs font-medium',
            trend.positive ? 'text-[var(--secondary)]' : 'text-[var(--primary)]'
          )}
        >
          {trend.text}
        </p>
      )}
    </Card>
  );
}
