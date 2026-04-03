import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label, TextArea, Select } from '../components/ui/Input';
import HtmlPreview, { HtmlViewModeToggle } from '../components/HtmlPreview';
import Badge from '../components/ui/Badge';
import { cn } from '../utils/cn';
import { api } from '../services/api';

const steps = [
  { id: 1, title: 'Details' },
  { id: 2, title: 'Audience' },
  { id: 3, title: 'Content' },
  { id: 4, title: 'Preview' },
  { id: 5, title: 'Schedule' },
];

const initialForm = {
  name: '',
  subject: '',
  body: '',
  selectedTemplateId: '',
  sendMode: 'now',
  scheduleAt: '',
};

const emptyManualClient = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  email: '',
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function dedupeContacts(list) {
  const seen = new Set();
  const out = [];
  for (const row of list) {
    const email = normalizeEmail(row.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      name: typeof row.name === 'string' ? row.name.trim() : '',
      email,
    });
  }
  return out;
}

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [bodyView, setBodyView] = useState('edit');

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  const [audienceMode, setAudienceMode] = useState('contacts');
  const [manualClients, setManualClients] = useState([]);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const { data } = await api.get('/templates');
      setTemplates(data.templates || []);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError('');
    try {
      const { data } = await api.get('/contacts');
      setContacts(data.contacts || []);
    } catch (e) {
      setContacts([]);
      setContactsError(e instanceof Error ? e.message : 'Could not load contacts');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadContacts();
  }, [loadTemplates, loadContacts]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

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
    setBodyView('edit');
  }

  const activeContacts = useMemo(
    () => contacts.filter((contact) => contact.subscribed !== false),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    const query = contactFilter.trim().toLowerCase();
    if (!query) return activeContacts;
    return activeContacts.filter((contact) => {
      const name = (contact.name || '').toLowerCase();
      const email = (contact.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [activeContacts, contactFilter]);

  function toggleContact(contactId) {
    setSelectedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = filteredContacts.map((contact) => contact.id);
    if (!visibleIds.length) return;

    const allSelected = visibleIds.every((id) => selectedContactIds.includes(id));
    setSelectedContactIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  function addManualClient() {
    setManualClients((current) => [...current, emptyManualClient()]);
  }

  function updateManualClient(index, field, value) {
    setManualClients((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function removeManualClient(index) {
    setManualClients((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  const manualContacts = useMemo(
    () => dedupeContacts(manualClients.filter((row) => EMAIL_RE.test(normalizeEmail(row.email)))),
    [manualClients],
  );

  const hasInvalidManualClient = manualClients.some((row) => {
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const email = normalizeEmail(row.email);
    return Boolean(name || email) && !EMAIL_RE.test(email);
  });

  const selectedContacts = useMemo(() => {
    const selected = new Set(selectedContactIds);
    return activeContacts
      .filter((contact) => selected.has(contact.id))
      .map((contact) => ({ name: contact.name || '', email: contact.email || '' }));
  }, [activeContacts, selectedContactIds]);

  const previewRecipients = audienceMode === 'contacts' ? selectedContacts : manualContacts;

  const hasAudienceInput =
    audienceMode === 'contacts'
      ? selectedContactIds.length > 0
      : manualContacts.length > 0;

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((contact) => selectedContactIds.includes(contact.id));

  function next() {
    setError('');
    setStep((s) => Math.min(5, s + 1));
  }

  function back() {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }

  async function finalizeCampaign() {
    if (step !== 5) return;

    setError('');
    if (form.sendMode === 'schedule' && !form.scheduleAt.trim()) {
      setError('Pick a date and time for scheduled send.');
      return;
    }

    setSubmitting(true);
    try {
      if (audienceMode === 'manual' && hasInvalidManualClient) {
        setError('Enter a valid email in every added client row, or remove the empty row.');
        setSubmitting(false);
        return;
      }

      const selectedIds =
        audienceMode === 'contacts'
          ? [...new Set(selectedContactIds.filter(Boolean))]
          : [];

      const manualOnly = audienceMode === 'manual' ? dedupeContacts(manualContacts) : [];

      let contactIds = selectedIds;

      if (manualOnly.length) {
        const { data: bulkData } = await api.post('/contacts/bulk', {
          contacts: manualOnly,
        });
        contactIds = [...new Set([...(bulkData.contactIds || []), ...selectedIds])];
      }

      if (!contactIds.length) {
        setError(
          audienceMode === 'contacts'
            ? 'Select at least one contact from saved audience.'
            : 'Add at least one valid client email.',
        );
        setSubmitting(false);
        return;
      }

      const scheduledAtIso =
        form.sendMode === 'schedule' && form.scheduleAt.trim()
          ? new Date(form.scheduleAt).toISOString()
          : undefined;

      const { data: createData } = await api.post('/campaign/create', {
        name: form.name.trim(),
        subject: form.subject.trim() || form.name.trim(),
        content: form.body,
        contactIds,
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });

      const campaignId = createData.campaign._id;
      await api.post(`/campaign/send/${campaignId}`, {
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });

      navigate('/app/campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
  }

  const canNext =
    step === 1
      ? form.name.trim()
      : step === 2
        ? hasAudienceInput
        : step === 3
          ? form.body.trim().length > 0
          : step === 4
            ? previewRecipients.length > 0
            : true;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/app/campaigns" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          {'<- Back to campaigns'}
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
                    : 'bg-slate-200 text-slate-600',
              )}
            >
              {step > s.id ? 'OK' : s.id}
            </button>
            <span className={cn('hidden text-sm font-medium sm:inline', step === s.id ? 'text-slate-900' : 'text-slate-500')}>
              {s.title}
            </span>
            {i < steps.length - 1 && <span className="hidden h-px w-6 bg-surface-border sm:block" aria-hidden />}
          </li>
        ))}
      </ol>

      <form
        onSubmit={handleFormSubmit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          if (e.target instanceof HTMLTextAreaElement) return;
          if (step < 5) e.preventDefault();
        }}
      >
        <Card>
          <CardHeader
            title={`Step ${step} - ${steps[step - 1].title}`}
            description={
              step === 1
                ? 'Name your campaign and set the subject line recipients will see.'
                : step === 2
                  ? 'Choose audience source: saved contacts or add new clients.'
                  : step === 3
                    ? 'Use placeholders like {{name}}, {{first_name}}, and {{email}} in your subject or body.'
                    : step === 4
                      ? 'Review header, content, and receiver list before sending.'
                      : 'Send immediately or schedule. Jobs are queued on the server.'
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
                <Input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="March newsletter" required />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {contactsError && (
                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {contactsError}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={audienceMode === 'contacts' ? 'primary' : 'secondary'}
                  onClick={() => {
                    setError('');
                    setAudienceMode('contacts');
                  }}
                >
                  Client from contacts
                </Button>
                <Button
                  type="button"
                  variant={audienceMode === 'manual' ? 'primary' : 'secondary'}
                  onClick={() => {
                    setError('');
                    setAudienceMode('manual');
                  }}
                >
                  Add new client
                </Button>
              </div>

              {audienceMode === 'contacts' ? (
                <Card className="space-y-4">
                  <CardHeader
                    title="Saved audience"
                    description="Select multiple enabled contacts from your stored list."
                    action={
                      <Button type="button" variant="secondary" size="sm" onClick={loadContacts} disabled={contactsLoading}>
                        {contactsLoading ? 'Loading...' : 'Refresh'}
                      </Button>
                    }
                  />

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="contactFilter">Search contacts</Label>
                      <Input id="contactFilter" value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} placeholder="Search by name or email" />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-500">
                        {selectedContactIds.length} selected of {filteredContacts.length} visible
                      </p>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllVisible}
                          disabled={!filteredContacts.length}
                        />
                        Select all
                      </label>
                    </div>

                    <div className="max-h-80 overflow-auto rounded-xl border border-surface-border bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-950/40">
                      {contactsLoading ? (
                        <div className="px-3 py-6 text-sm text-slate-500">Loading contacts...</div>
                      ) : filteredContacts.length === 0 ? (
                        <div className="px-3 py-6 text-sm text-slate-500">No contacts found.</div>
                      ) : (
                        <div className="space-y-2">
                          {filteredContacts.map((contact) => {
                            const checked = selectedContactIds.includes(contact.id);
                            return (
                              <label
                                key={contact.id}
                                className={cn(
                                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
                                  checked
                                    ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30'
                                    : 'border-transparent bg-white hover:border-surface-border dark:bg-slate-900',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                  checked={checked}
                                  onChange={() => toggleContact(contact.id)}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-slate-900 dark:text-slate-100">
                                      {contact.name || 'Unnamed contact'}
                                    </span>
                                    {contact.name ? <Badge variant="active">Named</Badge> : <Badge variant="inactive">No name</Badge>}
                                  </div>
                                  <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">{contact.email}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ) : (
                <Card>
                  <CardHeader
                    title="Add client"
                    description="Add named clients. New clients are always included when sending this campaign."
                  />
                  <div className="space-y-3">
                    {manualClients.length === 0 && (
                      <p className="text-sm text-slate-500">No manual clients yet. Add one to continue.</p>
                    )}
                    {manualClients.map((client, index) => (
                      <div key={client.id} className="rounded-xl border border-surface-border p-3 dark:border-slate-700">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`client-name-${index}`}>Name</Label>
                            <Input id={`client-name-${index}`} value={client.name} onChange={(e) => updateManualClient(index, 'name', e.target.value)} placeholder="Client name" />
                          </div>
                          <div>
                            <Label htmlFor={`client-email-${index}`}>Email</Label>
                            <Input id={`client-email-${index}`} type="email" value={client.email} onChange={(e) => updateManualClient(index, 'email', e.target.value)} placeholder="client@example.com" />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button type="button" variant="secondary" size="sm" onClick={() => removeManualClient(index)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" onClick={addManualClient}>
                      Add client
                    </Button>
                  </div>
                </Card>
              )}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
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
                  <Link to="/app/templates" className="font-medium text-brand-600 hover:text-brand-700">
                    Templates
                  </Link>
                  . Use placeholders like <span className="font-medium">{'{{name}}'}</span>, <span className="font-medium">{'{{first_name}}'}</span>, and <span className="font-medium">{'{{email}}'}</span> in subject or body.
                </p>
              </div>
              <div>
                <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor="body" className="mb-0">Email content (HTML)</Label>
                  <HtmlViewModeToggle value={bodyView} onChange={setBodyView} />
                </div>
                {bodyView === 'edit' ? (
                  <TextArea
                    id="body"
                    rows={12}
                    value={form.body}
                    onChange={(e) => update('body', e.target.value)}
                    placeholder={'<p>Hi {{first_name}},</p><p>Thanks for subscribing...</p>'}
                    required
                  />
                ) : (
                  <HtmlPreview html={form.body} minHeight="320px" emptyMessage="No HTML yet - switch to Edit HTML or pick a template." />
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <Card>
                <CardHeader title="Email header" description="Final subject and audience before queueing." />
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Campaign:</span> {form.name || '-'}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Subject:</span> {form.subject || form.name || '-'}</p>
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Audience mode:</span>{' '}
                    {audienceMode === 'contacts' ? 'Client from contacts' : 'Add new client'}
                  </p>
                </div>
              </Card>

              <Card>
                <CardHeader title="Email content" description="Placeholders are resolved per recipient at send time." />
                <HtmlPreview html={form.body} minHeight="260px" emptyMessage="No email content yet." />
              </Card>

              <Card>
                <CardHeader title={`Receiver list (${previewRecipients.length})`} description="These recipients will be used for this campaign." />
                <div className="max-h-72 overflow-auto rounded-xl border border-surface-border bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-950/40">
                  {previewRecipients.length === 0 ? (
                    <div className="px-3 py-6 text-sm text-slate-500">No recipients selected.</div>
                  ) : (
                    <div className="space-y-2">
                      {previewRecipients.map((recipient, idx) => (
                        <div key={`${recipient.email}-${idx}`} className="rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{recipient.name || 'Unnamed contact'}</p>
                          <p className="text-slate-600 dark:text-slate-300">{recipient.email}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="sendMode">When to send</Label>
                <Select
                  id="sendMode"
                  value={form.sendMode}
                  onChange={(e) => update('sendMode', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                >
                  <option value="now">Send now</option>
                  <option value="schedule">Schedule</option>
                </Select>
              </div>
              {form.sendMode === 'schedule' && (
                <div>
                  <Label htmlFor="scheduleAt">Date and time</Label>
                  <Input
                    id="scheduleAt"
                    type="datetime-local"
                    value={form.scheduleAt}
                    onChange={(e) => update('scheduleAt', e.target.value)}
                    required={form.sendMode === 'schedule'}
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-6">
            <Button type="button" variant="secondary" onClick={back} disabled={step === 1}>
              Back
            </Button>
            <div className="flex gap-3">
              {step < 5 ? (
                <Button type="button" onClick={next} disabled={!canNext}>
                  Continue
                </Button>
              ) : (
                <Button type="button" disabled={submitting} onClick={() => void finalizeCampaign()}>
                  {submitting ? 'Submitting...' : 'Submit campaign'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
