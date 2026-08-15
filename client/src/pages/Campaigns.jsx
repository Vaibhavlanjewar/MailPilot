import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import DataTable from '../components/ui/DataTable';
import Button, { LinkButton } from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { api } from '../services/api';
import { mapCampaignToTableRow } from '../utils/campaignMappers';

export default function Campaigns() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  // { rows: Row[] } while a confirmation dialog is open — covers both a
  // single-row delete and a bulk one, so there is one modal, not two.
  const [confirming, setConfirming] = useState(null);
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

  // Rows can disappear from under a stale selection after a delete or reload.
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
  }, [rows]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(row.id));

  function toggleRow(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  }

  async function handleDelete() {
    if (!confirming?.rows?.length) return;
    setDeleting(true);

    // allSettled rather than all: one campaign failing to delete (e.g. it was
    // already removed elsewhere) shouldn't block the rest of a bulk delete.
    const results = await Promise.allSettled(
      confirming.rows.map((row) => api.delete(`/campaign/${row.id}`)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.length - succeeded.length;
    const recipientsDeleted = succeeded.reduce(
      (sum, r) => sum + (Number(r.value?.data?.emailLogsDeleted) || 0),
      0,
    );

    if (confirming.rows.length === 1) {
      if (succeeded.length) {
        toast.success(
          recipientsDeleted
            ? `Deleted "${confirming.rows[0].name}" and ${recipientsDeleted} recipient record${recipientsDeleted === 1 ? '' : 's'}.`
            : `Deleted "${confirming.rows[0].name}".`,
        );
      } else {
        toast.error('Could not delete the campaign.');
      }
    } else {
      if (succeeded.length) {
        toast.success(
          `Deleted ${succeeded.length} campaign${succeeded.length === 1 ? '' : 's'}` +
            (recipientsDeleted ? ` and ${recipientsDeleted} recipient records` : '') +
            '.',
        );
      }
      if (failed) {
        toast.error(`${failed} campaign${failed === 1 ? '' : 's'} could not be deleted.`);
      }
    }

    setConfirming(null);
    setSelectedIds([]);
    setDeleting(false);
    load();
  }

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          aria-label="Select all campaigns"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
      ),
      className: 'w-10',
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.name}`}
          checked={selectedSet.has(row.id)}
          onChange={() => toggleRow(row.id)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
      ),
    },
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
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => navigate('/app/campaigns/new', { state: { duplicateFrom: row.id } })}
            className="rounded-lg px-2 py-1 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
          >
            Use again
          </button>
          <button
            type="button"
            onClick={() => setConfirming({ rows: [row] })}
            className="rounded-lg px-2 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            Delete
          </button>
        </div>
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

  const selectedRows = rows.filter((row) => selectedSet.has(row.id));

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

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-app bg-app-surface p-3">
          <p className="text-sm text-slate-500">
            {selectedRows.length ? `${selectedRows.length} selected` : 'Select campaigns to delete them together'}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!selectedRows.length}
            onClick={() => setConfirming({ rows: selectedRows })}
          >
            Delete selected
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-rose-600 dark:text-rose-400"
            onClick={() => setConfirming({ rows })}
          >
            Delete all
          </Button>
        </div>
      )}

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
              {confirming.rows.length === 1
                ? `Delete "${confirming.rows[0].name}"?`
                : `Delete ${confirming.rows.length} campaigns?`}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {confirming.rows.length === 1
                ? `This permanently removes the campaign and all ${confirming.rows[0].total || 0} recipient records, including their delivery status and open tracking. This can't be undone.`
                : `This permanently removes ${confirming.rows.length} campaigns and all ${confirming.rows.reduce((sum, r) => sum + (r.total || 0), 0)} recipient records across them, including delivery status and open tracking. This can't be undone.`}
            </p>
            {confirming.rows.some((r) => r.status !== 'completed') && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {confirming.rows.length === 1
                  ? "This campaign hasn't finished sending. Any emails still queued will be cancelled."
                  : "Some of these campaigns haven't finished sending. Any emails still queued for them will be cancelled."}
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
