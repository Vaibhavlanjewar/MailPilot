import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/ui/DataTable';
import Input, { Select } from '../components/ui/Input';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { value: 'recently-opened', label: 'Recently Opened' },
  { value: 'most-opened', label: 'Most Opened' },
  { value: 'not-opened', label: 'Not Opened First' },
];

function StatusDot({ opened, openCount }) {
  const title = opened ? `Opened ${openCount} times` : 'Not opened yet';
  const tick = openCount === 0 ? '✓' : '✓✓';
  return (
    <span
      className={opened ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-400'}
      title={title}
      aria-label={title}
      aria-hidden="true"
    >
      {tick}
    </span>
  );
}

export default function EmailTracking() {
  const [rows, setRows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [sort, setSort] = useState('recently-opened');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [campaignId, sort]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get('/email-tracking', {
          params: {
            page,
            limit: PAGE_SIZE,
            search: search || undefined,
            campaignId: campaignId || undefined,
            sort,
          },
        });

        if (cancelled) return;

        setRows(data.items || []);
        setCampaigns(data.campaigns || []);
        setPagination(
          data.pagination || {
            page,
            limit: PAGE_SIZE,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        );
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, search, campaignId, sort]);

  const columns = useMemo(
    () => [
      {
        key: 'status',
        header: 'Status',
        className: 'w-20',
        render: (row) => <StatusDot opened={row.opened} openCount={row.openCount} />,
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => row.name || '—',
      },
      {
        key: 'email',
        header: 'Email ID',
        render: (row) => row.email || '—',
      },
      {
        key: 'openCount',
        header: 'Open Count',
        className: 'tabular-nums',
        render: (row) => row.openCount,
      },
      {
        key: 'recentlyOpenedAt',
        header: 'Recently Opened',
        render: (row) => formatDateTime(row.recentlyOpenedAt),
      },
    ],
    [],
  );

  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total || 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-app">Email Tracking</h1>
        <p className="text-sm text-app-muted">
          Monitor who opened your campaign emails, how often they opened, and recent activity.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-app bg-app-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search by name or email"
          className="sm:col-span-2 lg:col-span-2"
        />

        <Select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          aria-label="Filter by campaign"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </Select>

        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort tracking">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          {error.message}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="No tracking data found"
        getRowClassName={() => ''}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app bg-app-surface p-4 text-sm text-app-muted">
        <p>
          Showing {from}-{to} of {pagination.total || 0}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || !pagination.hasPrevPage}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="min-w-16 text-center text-app">
            Page {pagination.page} / {Math.max(1, pagination.totalPages || 1)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || !pagination.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
