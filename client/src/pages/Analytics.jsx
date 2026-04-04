import { useCallback, useEffect, useMemo, useState } from 'react';
import Card, { CardHeader } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { LinkButton } from '../components/ui/Button';
import { api } from '../services/api';
import { formatNumber, formatPercent } from '../utils/format';

function BarChart({ title, subtitle, series, valueSuffix = '', max }) {
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

function ProgressGraph({ title, subtitle, series }) {
  return (
    <Card>
      <CardHeader title={title} description={subtitle} />
      <div className="space-y-4">
        {series.length ? (
          series.map((item) => {
            const total = Math.max(item.total || 0, 1);
            const sentPct = Math.max(4, ((item.sent || 0) / total) * 100);
            const failedPct = Math.max(0, ((item.failed || 0) / total) * 100);
            return (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                  <span className="font-medium text-slate-900">{item.name}</span>
                  <span>{formatNumber(item.sent)} / {formatNumber(item.total)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="flex h-full w-full">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-brand-500"
                      style={{ width: `${sentPct}%` }}
                      title={`Sent ${item.sent}/${item.total}`}
                    />
                    <div
                      className="bg-rose-400/80"
                      style={{ width: `${Math.min(failedPct, 100 - sentPct)}%` }}
                      title={`Failed ${item.failed}/${item.total}`}
                    />
                    <div className="flex-1 bg-slate-200" title="Remaining" />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No campaigns yet. Create one to see live analytics.
          </div>
        )}
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
        <div className={['h-full rounded-full bg-brand-500', widthClass].join(' ')} />
      </div>
    </div>
  );
}

function abbreviate(label) {
  if (!label) return 'Untitled';
  return label.length > 14 ? `${label.slice(0, 11)}...` : label;
}

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/analytics/summary');
      setSummary(data.summary || null);
      setRecentCampaigns(data.recentCampaigns || []);
      setStatusBreakdown(data.statusBreakdown || []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = summary || {
    totalCampaigns: 0,
    totalRecipients: 0,
    totalSent: 0,
    totalFailed: 0,
    pendingCampaigns: 0,
    processingCampaigns: 0,
    completedCampaigns: 0,
    deliveryRate: 0,
    failureRate: 0,
  };

  const sentByCampaign = useMemo(() => recentCampaigns, [recentCampaigns]);

  const statusSeries = useMemo(() => statusBreakdown, [statusBreakdown]);

  const statusMax = Math.max(...statusSeries.map((item) => item.value), 1);

  if (loading && !summary) return <PageLoader />;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        Live metrics from your campaigns and delivery stats.
      </p>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Campaigns"
          value={formatNumber(stats.totalCampaigns)}
          hint="All campaigns in the account"
          trend={
            stats.totalCampaigns > 0
              ? { positive: true, text: 'Loaded from API' }
              : { positive: true, text: 'Create a campaign to start' }
          }
        />
        <StatCard
          label="Recipients"
          value={formatNumber(stats.totalRecipients)}
          hint="Total contacts targeted"
          trend={
            stats.totalRecipients > 0
              ? { positive: true, text: 'Summed from campaign stats' }
              : { positive: true, text: 'No recipient data yet' }
          }
        />
        <StatCard
          label="Sent / failed"
          value={`${formatNumber(stats.totalSent)} / ${formatNumber(stats.totalFailed)}`}
          hint="Delivery outcome across campaigns"
          trend={
            stats.totalSent + stats.totalFailed > 0
              ? { positive: stats.failureRate < 10, text: 'Based on email logs' }
              : { positive: true, text: 'No sends yet' }
          }
          className="sm:col-span-2 xl:col-span-1"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <BarChart
          title="Campaign status mix"
          subtitle="Pending, processing, and completed campaigns"
          series={statusSeries}
          max={statusMax}
        />
        <ProgressGraph
          title="Sent vs total by campaign"
          subtitle="Actual delivery progress from campaign stats"
          series={sentByCampaign}
        />
      </section>

      <Card>
        <CardHeader
          title="Delivery funnel"
          description="Real counts from campaign stats instead of placeholder metrics."
        />
        <div className="max-w-lg space-y-4">
          <FunnelStrip label="Recipients" value={formatNumber(stats.totalRecipients)} widthClass="w-full" />
          <FunnelStrip label="Sent" value={formatNumber(stats.totalSent)} widthClass="w-4/5 sm:w-[82%]" />
          <FunnelStrip label="Failed" value={formatNumber(stats.totalFailed)} widthClass="w-1/4 sm:w-[18%]" />
          <div className="pt-2 text-xs text-slate-500">
            Delivery rate: {formatPercent(stats.deliveryRate)} | Failure rate: {formatPercent(stats.failureRate)}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card>
            <CardHeader
              title="Recent campaigns"
              description="Live data pulled from the analytics API."
              action={
                <LinkButton to="/app/campaigns" variant="secondary" size="sm">
                  Show all
                </LinkButton>
              }
            />
              <div className="space-y-3 text-sm text-slate-600">
                {recentCampaigns.length ? (
                  recentCampaigns.slice(0, 3).map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-white px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{campaign.name}</p>
                        <p className="text-xs text-slate-500">Status: {campaign.status}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>Sent {formatNumber(campaign.sent)} / {formatNumber(campaign.total)}</p>
                        <p>Failed {formatNumber(campaign.failed)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No campaigns available yet.</p>
                )}
              </div>
          </Card>
        </div>
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                <LinkButton to="/app/contacts" variant="ghost" className="!p-0 !shadow-none">
                  Import contacts (CSV)
                </LinkButton>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                <LinkButton to="/app/campaigns/new" variant="ghost" className="!p-0 !shadow-none">
                  New campaign
                </LinkButton>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
