import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { api } from '../services/api';
import { formatDate } from '../utils/format';

export default function Templates() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/templates');
      setRows(data.templates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this template?')) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.delete(`/templates/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    { key: 'name', header: 'Template' },
    { key: 'subject', header: 'Default subject' },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (row) => formatDate(row.updatedAt),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-44 text-right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Link to={`/app/templates/${row._id}/edit`}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={Boolean(deletingId)}
            >
              Edit
            </Button>
          </Link>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={deletingId === row._id}
            onClick={() => handleDelete(row._id)}
          >
            {deletingId === row._id ? '…' : 'Delete'}
          </Button>
        </div>
      ),
    },
  ];

  if (loading && rows.length === 0) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-app bg-app-surface shadow-app-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-app">Templates</h2>
          <Link to="/app/templates/new">
            <Button type="button" variant="secondary">
              Add New Template
            </Button>
          </Link>
        </div>
        <div className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            rows={rows.map((t) => ({ ...t, id: t._id }))}
            loading={loading}
            emptyMessage="No templates yet. Create one and then pick it in campaign step 3."
          />
        </div>
      </div>
      {error && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {error}
        </div>
      )}
    </div>
  );
}
