import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/ui/StatCard';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { LinkButton } from '../components/ui/Button';
import { api } from '../services/api';
import { mapCampaignToTableRow } from '../utils/campaignMappers';
import { formatDate, formatNumber, formatPercent } from '../utils/format';

function MailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

function BulkSendArrowIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden {...props}>
      <path d="M3 12h12" />
      <path d="M11 7l5 5-5 5" />
      <path d="M18 8h3" />
      <path d="M18 12h3" />
      <path d="M18 16h3" />
    </svg>
  );
}

function SendVolumeChart({ series }) {
  const peak = Math.max(...series.map((item) => item.total || item.sent || 0), 1);

  return (
    <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Send volume</h3>
        <p className="text-sm text-slate-500">Live total recipients and sent counts from your latest campaigns.</p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
          Sent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          Remaining
        </span>
      </div>
      <div className="flex h-56 items-end justify-between gap-1 sm:gap-2">
        {series.length ? (
          series.map((item) => (
            <div key={item.id} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end justify-center">
                <div className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-md bg-slate-100 shadow-sm transition hover:opacity-95">
                  <div
                    className="w-full bg-gradient-to-t from-brand-600 to-cyan-400"
                    style={{ height: `${Math.max(8, ((item.sent || 0) / peak) * 100)}%` }}
                    title={`Sent ${item.sent}/${item.total}`}
                  />
                  <div
                    className="w-full bg-slate-200"
                    style={{ height: `${Math.max(0, (((item.total || 0) - (item.sent || 0)) / peak) * 100)}%` }}
                    title={`Remaining ${Math.max((item.total || 0) - (item.sent || 0), 0)}`}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="max-w-16 truncate text-[11px] font-medium text-slate-500">{item.label}</p>
                <p className="text-[10px] text-slate-400">{formatNumber(item.sent)} / {formatNumber(item.total)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-12 text-sm text-slate-500">
            No campaign data yet.
          </div>
        )}
      </div>
    </div>
  );
}

function abbreviateLabel(label) {
  if (!label) return 'Untitled';
  return label.length > 12 ? `${label.slice(0, 9)}...` : label;
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignRes, analyticsRes] = await Promise.all([
        api.get('/campaign'),
        api.get('/analytics/summary'),
      ]);
      setCampaigns(campaignRes.data.campaigns || []);
      setAnalytics(analyticsRes.data || null);
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
    const summary = analytics?.summary;
    if (summary) {
      return summary;
    }
    const totalSent = campaigns.reduce((s, c) => s + (c.stats?.sent || 0), 0);
    const totalRecipients = campaigns.reduce((s, c) => s + (c.stats?.total || 0), 0);
    const failed = campaigns.reduce((s, c) => s + (c.stats?.failed || 0), 0);
    const denom = totalSent + failed;
    const successRate = denom > 0 ? (100 * totalSent) / denom : 0;
    const deliveryRate = totalRecipients > 0 ? (100 * totalSent) / totalRecipients : 0;
    const failureRate = totalRecipients > 0 ? (100 * failed) / totalRecipients : 0;
    return {
      totalCampaigns: campaigns.length,
      totalRecipients,
      totalSent,
      totalFailed: failed,
      pendingCampaigns: campaigns.filter((c) => c.status === 'pending').length,
      processingCampaigns: campaigns.filter((c) => c.status === 'processing').length,
      completedCampaigns: campaigns.filter((c) => c.status === 'completed').length,
      deliveryRate,
      failureRate,
      successRate,
    };
  }, [analytics, campaigns]);

  const sendVolumeSeries = useMemo(() => {
    const recent = analytics?.recentCampaigns || [];
    if (recent.length) {
      return recent.map((campaign) => ({
        id: campaign.id,
        label: abbreviateLabel(campaign.name),
        sent: campaign.sent || 0,
        total: campaign.total || 0,
      }));
    }
    return campaigns
      .slice(0, 7)
      .map((campaign) => ({
        id: campaign._id,
        label: abbreviateLabel(campaign.name),
        sent: campaign.stats?.sent || 0,
        total: campaign.stats?.total || 0,
      }));
  }, [analytics?.recentCampaigns, campaigns]);

  const recentRows = useMemo(
    () => campaigns.slice(0, 3).map(mapCampaignToTableRow),
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
          label="Total recipients"
          value={formatNumber(stats.totalRecipients || 0)}
          hint="Across all campaigns"
          trend={
            (stats.totalRecipients || 0) > 0
              ? { positive: true, text: 'Summed from live campaigns' }
              : { positive: true, text: 'Create a campaign to start' }
          }
        />
        <StatCard
          label="Success rate"
          value={formatPercent(stats.successRate || 0)}
          hint="Sent vs failed (queued jobs)"
          trend={
            (stats.totalSent || 0) + (stats.totalFailed || 0) > 0
              ? { positive: (stats.successRate || 0) >= 90, text: 'Based on job results' }
              : { positive: true, text: 'No sends yet' }
          }
        />
        <StatCard
          label="Failed emails"
          value={formatNumber(stats.totalFailed || 0)}
          hint="After retries"
          trend={
            (stats.totalFailed || 0) > 0
              ? { positive: false, text: 'Check campaign status & SMTP' }
              : { positive: true, text: 'No failures recorded' }
          }
          className="sm:col-span-2 xl:col-span-1"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SendVolumeChart series={sendVolumeSeries} />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-2xl border border-surface-border bg-white p-5 shadow-card sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900">Quick actions</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <MailIcon className="h-4 w-4 text-brand-600" />
                <LinkButton to="/app/contacts" variant="ghost" className="!p-0 !shadow-none">
                  Import contacts (CSV)
                </LinkButton>
              </li>
              <li className="flex items-center gap-2">
                <BulkSendArrowIcon className="h-4 w-4 text-brand-600" />
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
