import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { api } from '../services/api';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function recipientVariant(status) {
  if (status === 'sent') return 'completed';
  if (status === 'failed') return 'failed';
  return 'scheduled';
}

export default function CampaignDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [summary, setSummary] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });
  const [recipients, setRecipients] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/campaign/status/${id}`);
      setCampaign(data.campaign || null);
      setSummary(data.summary || { total: 0, sent: 0, failed: 0, queued: 0 });
      setRecipients(data.recipients || []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/app/campaigns" className="text-sm font-medium text-brand-700 hover:underline">
          Back to campaigns
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          {error.message}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <Link to="/app/campaigns" className="text-sm font-medium text-brand-700 hover:underline">
          Back to campaigns
        </Link>
        <div className="rounded-xl border border-surface-border bg-white p-6 text-slate-600 shadow-card dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Campaign not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Link to="/app/campaigns" className="text-sm font-medium text-brand-700 hover:underline">
            Back to campaigns
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {campaign.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {campaign.subject}
            </p>
          </div>
        </div>
        <Badge variant={campaign.status === 'completed' ? 'completed' : campaign.status === 'processing' ? 'sending' : 'draft'}>
          {campaign.status}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{summary.total}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Sent</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{summary.sent}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Failed</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700 dark:text-rose-300">{summary.failed}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate-500">Queued</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">{summary.queued}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recipient delivery list"
          description="See who received the campaign and who failed or is still queued."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={load}>
              Refresh
            </Button>
          }
        />

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-border text-left text-sm dark:divide-slate-700">
            <thead className="bg-surface-muted/80 dark:bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Recipient</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Attempts</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Last tried</th>
                <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border bg-white dark:divide-slate-700 dark:bg-slate-900">
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No delivery records found yet.
                  </td>
                </tr>
              ) : (
                recipients.map((recipient) => (
                  <tr key={String(recipient._id || recipient.contactId || recipient.toEmail)} className="align-top">
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      <div className="font-medium">
                        {recipient.name || 'Unnamed contact'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{recipient.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={recipientVariant(recipient.status)}>{recipient.status}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                      {recipient.attempts ?? 0}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {formatDate(recipient.lastAttemptAt || recipient.updatedAt || recipient.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                      {recipient.error || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}