import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label, TextArea, Select } from '../components/ui/Input';
import { cn } from '../utils/cn';
import { api } from '../services/api';
import {
  extractEmailsFromText,
  mergeEmailLists,
  readFileAsText,
} from '../utils/emails';

const steps = [
  { id: 1, title: 'Details' },
  { id: 2, title: 'Audience' },
  { id: 3, title: 'Content' },
  { id: 4, title: 'Schedule' },
];

const initialForm = {
  name: '',
  subject: '',
  recipientsRaw: '',
  body: '',
  /** @type {string} selected template Mongo id, or '' */
  selectedTemplateId: '',
  sendMode: 'now',
  scheduleAt: '',
};

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [csvBusy, setCsvBusy] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTemplatesLoading(true);
      try {
        const { data } = await api.get('/templates');
        if (!cancelled) setTemplates(data.templates || []);
      } catch {
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function applyTemplate(templateId) {
    if (!templateId) {
      update('selectedTemplateId', '');
      return;
    }
    const tpl = templates.find((t) => String(t._id) === templateId);
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      selectedTemplateId: templateId,
      subject: tpl.subject,
      body: tpl.body || '',
    }));
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCsvChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setCsvBusy(true);
    try {
      const text = await readFileAsText(file);
      const fromCsv = extractEmailsFromText(text);
      if (!fromCsv.length) {
        setError(
          'No valid email addresses found in that CSV. Use an email column (header: email).'
        );
        return;
      }
      setForm((f) => ({
        ...f,
        recipientsRaw: mergeEmailLists(f.recipientsRaw, text),
      }));
    } catch {
      setError('Could not read that file. Try a UTF-8 .csv file.');
    } finally {
      setCsvBusy(false);
    }
  }

  function next() {
    setError('');
    setStep((s) => Math.min(4, s + 1));
  }
  function back() {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.sendMode === 'schedule' && !form.scheduleAt.trim()) return;

    setSubmitting(true);
    try {
      const emails = extractEmailsFromText(form.recipientsRaw);

      if (!emails.length) {
        setError('Add at least one valid email (paste or CSV).');
        setSubmitting(false);
        return;
      }

      const { data: bulkData } = await api.post('/contacts/bulk', {
        contacts: emails.map((email) => ({ email })),
      });

      const contactIds = bulkData.contactIds;
      if (!contactIds?.length) {
        throw new Error('No contacts were saved');
      }

      const scheduledAtIso =
        form.sendMode === 'schedule' && form.scheduleAt.trim()
          ? new Date(form.scheduleAt).toISOString()
          : undefined;

      const { data: createData } = await api.post('/campaign/create', {
        name: form.name.trim(),
        subject: form.subject.trim(),
        content: form.body,
        contactIds,
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });

      const campaignId = createData.campaign._id;
      await api.post(`/campaign/send/${campaignId}`, {
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });

      navigate('/campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const canNext =
    step === 1
      ? form.name.trim() && form.subject.trim()
      : step === 2
        ? form.recipientsRaw.trim().length > 3
        : step === 3
          ? form.body.trim().length > 0
          : true;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/campaigns"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to campaigns
        </Link>
      </div>

      <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                step === s.id
                  ? 'bg-brand-600 text-white shadow-md'
                  : step > s.id
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
              )}
            >
              {step > s.id ? '✓' : s.id}
            </button>
            <span
              className={cn(
                'hidden text-sm font-medium sm:inline',
                step === s.id ? 'text-slate-900' : 'text-slate-500'
              )}
            >
              {s.title}
            </span>
            {i < steps.length - 1 && (
              <span className="hidden h-px w-6 bg-surface-border sm:block" aria-hidden />
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader
            title={`Step ${step} — ${steps[step - 1].title}`}
            description={
              step === 1
                ? 'Name your campaign and set the subject line recipients will see.'
                : step === 2
                  ? 'Upload a CSV or paste emails (one per line). Recipients are saved to your account.'
                  : step === 3
                    ? 'Optionally start from a saved template, then edit. HTML is supported.'
                    : 'Send immediately or schedule. Jobs are queued on the server (Redis + BullMQ).'
            }
          />

          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="March newsletter"
                  required
                />
              </div>
              <div>
                <Label htmlFor="subject">Email subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => update('subject', e.target.value)}
                  placeholder="Your update inside…"
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv">Upload CSV (optional)</Label>
                <input
                  id="csv"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={csvBusy}
                  className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100 disabled:opacity-50"
                  onChange={handleCsvChange}
                />
                {csvBusy && (
                  <p className="mt-1 text-xs text-slate-500">Reading CSV…</p>
                )}
              </div>
              <div>
                <Label htmlFor="recipients">Or paste emails</Label>
                <TextArea
                  id="recipients"
                  rows={8}
                  value={form.recipientsRaw}
                  onChange={(e) => update('recipientsRaw', e.target.value)}
                  placeholder={'alex@company.com\njamie@example.org'}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Uploading a CSV fills this list with addresses from the file (merged with
                  anything you already pasted).
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="template">Template (optional)</Label>
                <Select
                  id="template"
                  value={form.selectedTemplateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  disabled={templatesLoading}
                >
                  <option value="">Write from scratch</option>
                  {templates.map((t) => (
                    <option key={t._id} value={String(t._id)}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Templates are created under{' '}
                  <Link
                    to="/templates"
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Templates
                  </Link>
                  . Choosing one fills the subject (you can change it in step 1) and this
                  body.
                </p>
                {!templatesLoading && templates.length === 0 && (
                  <p className="mt-2 text-sm text-amber-800">
                    No templates yet —{' '}
                    <Link
                      to="/templates"
                      className="font-medium text-brand-700 underline"
                    >
                      create one first
                    </Link>
                    .
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="body">Email content</Label>
                <TextArea
                  id="body"
                  rows={12}
                  value={form.body}
                  onChange={(e) => update('body', e.target.value)}
                  placeholder={'<p>Hi {{first_name}},</p><p>Thanks for subscribing…</p>'}
                  required
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="sendMode">When to send</Label>
                <Select
                  id="sendMode"
                  value={form.sendMode}
                  onChange={(e) => update('sendMode', e.target.value)}
                >
                  <option value="now">Send now</option>
                  <option value="schedule">Schedule</option>
                </Select>
              </div>
              {form.sendMode === 'schedule' && (
                <div>
                  <Label htmlFor="scheduleAt">Date & time</Label>
                  <Input
                    id="scheduleAt"
                    type="datetime-local"
                    value={form.scheduleAt}
                    onChange={(e) => update('scheduleAt', e.target.value)}
                    required={form.sendMode === 'schedule'}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Uses your computer&apos;s local timezone. Emails queue after this time.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-6">
            <Button type="button" variant="secondary" onClick={back} disabled={step === 1}>
              Back
            </Button>
            <div className="flex gap-3">
              {step < 4 ? (
                <Button type="button" onClick={next} disabled={!canNext}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit campaign'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
