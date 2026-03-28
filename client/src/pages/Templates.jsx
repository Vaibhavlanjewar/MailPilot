import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Input, { Label, TextArea } from '../components/ui/Input';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { api } from '../services/api';
import { formatDate } from '../utils/format';

export default function Templates() {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
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

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/templates', {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      setName('');
      setSubject('');
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save template');
    } finally {
      setSaving(false);
    }
  }

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
      className: 'w-24 text-right',
      render: (row) => (
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={deletingId === row._id}
          onClick={() => handleDelete(row._id)}
        >
          {deletingId === row._id ? '…' : 'Delete'}
        </Button>
      ),
    },
  ];

  if (loading && rows.length === 0) return <PageLoader />;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Library</h2>
          <Link
            to="/campaigns/new"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            New campaign →
          </Link>
        </div>
        {error && (
          <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {error}
          </div>
        )}
        <DataTable
          columns={columns}
          rows={rows.map((t) => ({ ...t, id: t._id }))}
          loading={loading}
          emptyMessage="No templates yet. Create one on the right — then pick it in campaign step 3."
        />
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader
            title="New template"
            description="Subject and body are used when you choose this template while creating a campaign."
          />
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Welcome email"
                required
              />
            </div>
            <div>
              <Label htmlFor="tpl-subject">Default subject</Label>
              <Input
                id="tpl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Welcome to {{company}}"
                required
              />
            </div>
            <div>
              <Label htmlFor="tpl-body">Body (HTML)</Label>
              <TextArea
                id="tpl-body"
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="<p>Hi there,</p><p>…</p>"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving ? 'Saving…' : 'Create template'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
