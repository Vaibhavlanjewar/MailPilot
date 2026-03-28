import { useMemo } from 'react';
import Card, { CardHeader } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { useMockFetch } from '../hooks/useMockFetch';
import { mockRequest } from '../services/api';
import { analyticsSummary } from '../services/mockData';
import { formatPercent } from '../utils/format';
import { cn } from '../utils/cn';

function BarChart({ title, subtitle, series, valueSuffix = '%', max }) {
  const peak = max ?? Math.max(...series.map((s) => s.value), 1);
  return (
    <Card>
      <CardHeader title={title} description={subtitle} />
      <div className="flex h-56 items-end justify-between gap-1 sm:gap-2">
        {series.map((s) => (
          <div key={s.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-10 rounded-t-md bg-gradient-to-t from-indigo-600 to-brand-400 shadow-sm transition hover:opacity-95"
                style={{ height: `${Math.max(8, (s.value / peak) * 100)}%` }}
                title={`${s.value}${valueSuffix}`}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-500">{s.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FunnelStrip({ label, value, widthClass }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full bg-brand-500', widthClass)} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const fetchAnalytics = useMemo(
    () => () => mockRequest(analyticsSummary, 700),
    []
  );
  const { data, loading, error } = useMockFetch(fetchAnalytics, [fetchAnalytics]);

  if (loading && !data) return <PageLoader />;
  if (error)
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        {error.message}
      </div>
    );

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        Illustrative metrics — swap in real reporting when your API is ready.
      </p>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Open rate"
          value={formatPercent(data.openRate)}
          hint="Last 30 days (mock)"
        />
        <StatCard
          label="Click rate"
          value={formatPercent(data.clickRate)}
          hint="Last 30 days (mock)"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <BarChart
          title="Opens by day"
          subtitle="Relative volume across the week"
          series={data.openSeries}
          valueSuffix="%"
          max={100}
        />
        <BarChart
          title="Clicks by day"
          subtitle="Click-through rate trend"
          series={data.clickSeries}
          valueSuffix="%"
          max={10}
        />
      </section>

      <Card>
        <CardHeader
          title="Funnel (dummy)"
          description="Simplified journey — tuned for layout preview."
        />
        <div className="max-w-lg space-y-4">
          <FunnelStrip label="Delivered" value="100%" widthClass="w-full" />
          <FunnelStrip label="Opened" value={`${data.openRate}%`} widthClass="w-5/12 sm:w-[42%]" />
          <FunnelStrip label="Clicked" value={`${data.clickRate}%`} widthClass="w-1/6 sm:w-[15%]" />
        </div>
      </Card>
    </div>
  );
}
