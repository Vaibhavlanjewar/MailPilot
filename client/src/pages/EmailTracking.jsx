import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataTable from '../components/ui/DataTable';
import Input, { Select } from '../components/ui/Input';
import Button from '../components/ui/Button';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

const PAGE_SIZE = 10;
const LIVE_REFRESH_MS = 12000;
const LIVE_ANIMATION_MS = 1400;

const SORT_OPTIONS = [
  { value: 'recently-opened', label: 'Recently Opened' },
  { value: 'most-opened', label: 'Most Opened' },
  { value: 'not-opened', label: 'Not Opened First' },
];

function StatusDot({ opened, openCount, isLive }) {
  const title = opened ? `Opened ${openCount} times` : 'Not opened yet';
  const tick = openCount === 0 ? '✓' : '✓✓';
  return (
    <span
      className={[
        opened ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-400',
        isLive ? 'animate-tracking-open-pop' : '',
      ].join(' ')}
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
  const [liveAnimatedRows, setLiveAnimatedRows] = useState({});
  const prevOpenCountRef = useRef(new Map());
  const animationTimeoutsRef = useRef(new Map());

  const markRowsLive = useCallback((ids) => {
    if (!ids.length) return;
    setLiveAnimatedRows((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    ids.forEach((id) => {
      const existing = animationTimeoutsRef.current.get(id);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        setLiveAnimatedRows((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        animationTimeoutsRef.current.delete(id);
      }, LIVE_ANIMATION_MS);
      animationTimeoutsRef.current.set(id, timeout);
    });
  }, []);

  const loadTracking = useCallback(
    async ({ silent = false, animateDiff = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

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

        const incoming = data.items || [];
        if (animateDiff) {
          const changedIds = [];
          incoming.forEach((row) => {
            const previous = prevOpenCountRef.current.get(row.id);
            const current = Number(row.openCount || 0);
            if (typeof previous === 'number' && current > previous) {
              changedIds.push(row.id);
            }
          });
          markRowsLive(changedIds);
        }

        const nextMap = new Map();
        incoming.forEach((row) => {
          nextMap.set(row.id, Number(row.openCount || 0));
        });
        prevOpenCountRef.current = nextMap;

        setRows(incoming);
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
        if (!silent) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [campaignId, markRowsLive, page, search, sort],
  );

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
    loadTracking();
  }, [loadTracking]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadTracking({ silent: true, animateDiff: true });
    }, LIVE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadTracking]);

  useEffect(() => {
    return () => {
      animationTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      animationTimeoutsRef.current.clear();
    };
  }, []);

  const columns = useMemo(
    () => [
      {
        key: 'status',
        header: 'Status',
        className: 'w-20',
        render: (row) => (
          <StatusDot
            opened={row.opened}
            openCount={row.openCount}
            isLive={Boolean(liveAnimatedRows[row.id])}
          />
        ),
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
    [liveAnimatedRows],
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
        getRowClassName={(row) => (liveAnimatedRows[row.id] ? 'animate-tracking-row-flash' : '')}
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
