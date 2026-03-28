import Card, { CardHeader } from './Card';
import { cn } from '../../utils/cn';

export default function ChartPlaceholder({ title = 'Engagement overview', description }) {
  const bars = [45, 72, 58, 88, 64, 92, 78];
  return (
    <Card>
      <CardHeader
        title={title}
        description={description || 'Placeholder chart — connect analytics API to render live data.'}
      />
      <div className="flex h-48 items-end justify-between gap-2 sm:gap-3">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={cn(
                'w-full max-w-[2.5rem] rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 opacity-90 transition-all hover:opacity-100',
                'min-h-[12%]'
              )}
              style={{ height: `${h}%` }}
              title={`${h}%`}
            />
            <span className="text-[10px] font-medium text-slate-400">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
