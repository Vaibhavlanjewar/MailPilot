import { useCallback, useEffect, useState } from 'react';
import DataTable from '../components/ui/DataTable';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { api } from '../services/api';

export default function Contacts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/contacts');
      setRows(data.contacts || []);
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
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'subscribed',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.subscribed ? 'active' : 'inactive'}>
          {row.subscribed ? 'Subscribed' : 'Unsubscribed'}
        </Badge>
      ),
    },
  ];

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/contacts/upload', formData);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setUploadBusy(false);
      e.target.value = '';
    }
  }

  if (loading && !rows.length) return <PageLoader />;
  if (error && !rows.length) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error.message}
        </div>
      )}
      <Card>
        <CardHeader
          title="Import contacts"
          description="Upload a CSV with an email column (optional name column)."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => load()}>
              Refresh list
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={handleFile}
              disabled={uploadBusy}
            />
            <span className="inline-flex rounded-lg border border-surface-border bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              {uploadBusy ? 'Uploading…' : 'Upload CSV'}
            </span>
          </label>
          <p className="text-sm text-slate-500">Files are sent to the server and merged with your list.</p>
        </div>
      </Card>

      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">All contacts</h2>
          <p className="text-sm text-slate-500">{rows.length} total</p>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading && rows.length > 0}
          emptyMessage="No contacts yet. Upload a CSV or add them when creating a campaign."
        />
      </div>
    </div>
  );
}
