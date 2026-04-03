import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/ui/StatCard';
import ChartPlaceholder from '../components/ui/ChartPlaceholder';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { LinkButton } from '../components/ui/Button';
import { api } from '../services/api';
import { mapCampaignToTableRow } from '../utils/campaignMappers';
import { formatDate, formatNumber, formatPercent } from '../utils/format';

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/campaign');
      setCampaigns(data.campaigns || []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const totalSent = campaigns.reduce((s, c) => s + (c.stats?.sent || 0), 0);
    const failed = campaigns.reduce((s, c) => s + (c.stats?.failed || 0), 0);
    const denom = totalSent + failed;
    const successRate = denom > 0 ? (100 * totalSent) / denom : 0;
    return { totalSent, failed, successRate };
  }, [campaigns]);

  const recentRows = useMemo(
    () => campaigns.slice(0, 5).map(mapCampaignToTableRow),
    [campaigns]
  );

  const columns = [
    { key: 'name', header: 'Campaign' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status}>{row.statusLabel}</Badge>
      ),
    },
    {
      key: 'sent',
      header: 'Sent',
      className: 'tabular-nums',
      render: (row) => formatNumber(row.sent),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => formatDate(row.date),
    },
  ];

  if (loading && !campaigns.length) return <PageLoader />;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">
          Welcome back — stats and campaigns come from your API.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total emails sent"
          value={formatNumber(stats.totalSent)}
          hint="Across all campaigns"
          trend={
            stats.totalSent > 0
              ? { positive: true, text: 'From completed sends' }
              : { positive: true, text: 'Create a campaign to start' }
          }
        />
        <StatCard
          label="Success rate"
          value={formatPercent(stats.successRate)}
          hint="Sent vs failed (queued jobs)"
          trend={
            stats.totalSent + stats.failed > 0
              ? { positive: stats.successRate >= 90, text: 'Based on job results' }
              : { positive: true, text: 'No sends yet' }
          }
        />
        <StatCard
          label="Failed emails"
          value={formatNumber(stats.failed)}
          hint="After retries"
          trend={
            stats.failed > 0
              ? { positive: false, text: 'Check campaign status & SMTP' }
              : { positive: true, text: 'No failures recorded' }
          }
          className="sm:col-span-2 xl:col-span-1"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ChartPlaceholder
            title="Send volume (preview)"
            description="Hook this chart to analytics when you add reporting endpoints."
          />
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

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent campaigns</h2>
            <p className="text-sm text-slate-500">Latest from the server.</p>
          </div>
          <LinkButton to="/app/campaigns" variant="secondary" size="sm">
            View all
          </LinkButton>
        </div>
        <DataTable
          columns={columns}
          rows={recentRows}
          loading={false}
          emptyMessage="No campaigns yet. Create one to see it here."
        />
      </section>
    </div>
  );
}
