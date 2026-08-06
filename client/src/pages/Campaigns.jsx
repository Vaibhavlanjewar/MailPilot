import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import DataTable from '../components/ui/DataTable';
import Button, { LinkButton } from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { api } from '../services/api';
import { mapCampaignToTableRow } from '../utils/campaignMappers';

export default function Campaigns() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(null); // the row pending confirmation
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/campaign');
      const list = (data.campaigns || []).map(mapCampaignToTableRow);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!confirming) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/campaign/${confirming.id}`);
      toast.success(
        data.emailLogsDeleted
          ? `Deleted "${confirming.name}" and ${data.emailLogsDeleted} recipient record${data.emailLogsDeleted === 1 ? '' : 's'}.`
          : `Deleted "${confirming.name}".`,
      );
      setConfirming(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the campaign.');
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Link
          to={`/app/campaigns/${row.id}`}
          className="font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          {row.name}
        </Link>
      ),
    },
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
      render: (row) => `${row.sent}/${row.total}`,
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) =>
        row.date
          ? new Intl.DateTimeFormat(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }).format(new Date(row.date))
          : '—',
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={() => setConfirming(row)}
          className="rounded-lg px-2 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          Delete
        </button>
      ),
    },
  ];

  if (loading && !rows.length) return <PageLoader />;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-slate-500">
          Campaigns from the API. After you submit a campaign, it appears here with live status.
        </p>
        <LinkButton to="/app/campaigns/new" size="md">
          Create campaign
        </LinkButton>
      </div>
      <DataTable columns={columns} rows={rows} loading={false} emptyMessage="No campaigns yet." />

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setConfirming(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Delete "{confirming.name}"?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This permanently removes the campaign and all {confirming.total || 0} recipient
              records, including their delivery status and open tracking. This can't be undone.
            </p>
            {confirming.status !== 'completed' && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                This campaign hasn't finished sending. Any emails still queued will be cancelled.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(null)} disabled={deleting}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
