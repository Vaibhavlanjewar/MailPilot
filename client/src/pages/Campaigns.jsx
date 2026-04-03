import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/ui/DataTable';
import { LinkButton } from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { api } from '../services/api';
import { mapCampaignToTableRow } from '../utils/campaignMappers';

export default function Campaigns() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    </div>
  );
}
