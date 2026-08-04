import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Label, TextArea, Select } from '../components/ui/Input';
import HtmlPreview, { HtmlViewModeToggle } from '../components/HtmlPreview';
import Badge from '../components/ui/Badge';
import { toast } from 'react-toastify';
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
  attachResume: true,
};

const emptyManualClient = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  email: '',
  company: '',
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS_PER_CAMPAIGN = 100;
const DAILY_RECIPIENT_LIMIT = 450;
const CONTACT_BATCH_SIZE = 100;
const CUSTOM_BATCH_VALUE = '__custom_range__';

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
      company: typeof row.company === 'string' ? row.company.trim() : '',
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
  const [hasResume, setHasResume] = useState(false);
  const [contactFilter, setContactFilter] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  const [audienceMode, setAudienceMode] = useState('contacts');
  const [manualClients, setManualClients] = useState([]);
  const [selectedContactBatch, setSelectedContactBatch] = useState('');
  const [customRangeStart, setCustomRangeStart] = useState('');
  const [customRangeEnd, setCustomRangeEnd] = useState('');
  const [campaignLimits, setCampaignLimits] = useState({
    maxRecipientsPerCampaign: MAX_RECIPIENTS_PER_CAMPAIGN,
    dailyLimit: DAILY_RECIPIENT_LIMIT,
    sentToday: 0,
    remainingToday: DAILY_RECIPIENT_LIMIT,
  });

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

  const loadCampaignLimits = useCallback(async () => {
    try {
      const { data } = await api.get('/campaign/limits');
      setCampaignLimits({
        maxRecipientsPerCampaign: Number(data?.maxRecipientsPerCampaign) || MAX_RECIPIENTS_PER_CAMPAIGN,
        dailyLimit: Number(data?.dailyLimit) || DAILY_RECIPIENT_LIMIT,
        sentToday: Number(data?.sentToday) || 0,
        remainingToday: Number(data?.remainingToday) || 0,
      });
    } catch {
      setCampaignLimits((prev) => ({
        ...prev,
        maxRecipientsPerCampaign: MAX_RECIPIENTS_PER_CAMPAIGN,
        dailyLimit: DAILY_RECIPIENT_LIMIT,
      }));
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    loadContacts();
    loadCampaignLimits();
    api
      .get('/resumes/me')
      .then(({ data }) => setHasResume(Boolean(data.resume)))
      .catch(() => setHasResume(false));
  }, [loadTemplates, loadContacts, loadCampaignLimits]);

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
      const company = (contact.company || '').toLowerCase();
      return name.includes(query) || email.includes(query) || company.includes(query);
    });
  }, [activeContacts, contactFilter]);

  const filteredContactSerialMap = useMemo(() => {
    const map = new Map();
    filteredContacts.forEach((contact, index) => {
      map.set(contact.id, index + 1);
    });
    return map;
  }, [filteredContacts]);

  const step2Contacts = useMemo(() => {
    const selectedSet = new Set(selectedContactIds);
    const selected = [];
    const unselected = [];

    for (const contact of filteredContacts) {
      if (selectedSet.has(contact.id)) selected.push(contact);
      else unselected.push(contact);
    }

    return [...selected, ...unselected];
  }, [filteredContacts, selectedContactIds]);

  function toggleContact(contactId) {
    setSelectedContactBatch('');
    setSelectedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
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
    const company = typeof row.company === 'string' ? row.company.trim() : '';
    const email = normalizeEmail(row.email);
    return Boolean(name || company || email) && !EMAIL_RE.test(email);
  });

  const selectedContacts = useMemo(() => {
    const selected = new Set(selectedContactIds);
    return activeContacts
      .filter((contact) => selected.has(contact.id))
      .map((contact) => ({
        name: contact.name || '',
        email: contact.email || '',
        company: contact.company || '',
      }));
  }, [activeContacts, selectedContactIds]);

  const previewRecipients = audienceMode === 'contacts' ? selectedContacts : manualContacts;

  const contactBatchOptions = useMemo(() => {
    const options = [];
    for (let start = 0; start < activeContacts.length; start += CONTACT_BATCH_SIZE) {
      const endExclusive = Math.min(start + CONTACT_BATCH_SIZE, activeContacts.length);
      const startLabel = start + 1;
      const endLabel = endExclusive;
      options.push({
        value: `${startLabel}-${endLabel}`,
        label: `${startLabel}-${endLabel}`,
        ids: activeContacts.slice(start, endExclusive).map((contact) => contact.id),
      });
    }
    return options;
  }, [activeContacts]);

  function selectContactBatch(value) {
    setSelectedContactBatch(value);
    if (value === CUSTOM_BATCH_VALUE) {
      setSelectedContactIds([]);
      return;
    }
    if (!value) return;
    const batch = contactBatchOptions.find((option) => option.value === value);
    if (!batch) return;
    setSelectedContactIds(batch.ids);
    setError('');
  }

  function applyCustomRange() {
    const start = Number.parseInt(customRangeStart, 10);
    const end = Number.parseInt(customRangeEnd, 10);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      toast.error('Enter valid start and end numbers');
      return;
    }

    if (start < 1 || end < 1 || start > end) {
      toast.error('Invalid range. Use start <= end and values >= 1');
      return;
    }

    if (end > activeContacts.length) {
      toast.error(`Range end cannot exceed ${activeContacts.length}`);
      return;
    }

    const count = end - start + 1;
    if (count > CONTACT_BATCH_SIZE) {
      toast.error('Custom range cannot be more than 100 contacts');
      return;
    }

    const ids = activeContacts.slice(start - 1, end).map((contact) => contact.id);
    setSelectedContactIds(ids);
    setError('');
  }

  const hasAudienceInput =
    audienceMode === 'contacts'
      ? selectedContactIds.length > 0
      : manualContacts.length > 0;

  const selectedRecipientsCount = previewRecipients.length;
  const campaignLimitExceeded = selectedRecipientsCount > campaignLimits.maxRecipientsPerCampaign;
  const dailyLimitExceeded = selectedRecipientsCount > campaignLimits.remainingToday;

  const audienceLimitError =
    campaignLimitExceeded
      ? `Max ${campaignLimits.maxRecipientsPerCampaign} recipients allowed per campaign.`
      : dailyLimitExceeded
        ? `Daily limit exceeded. Remaining today: ${campaignLimits.remainingToday} of ${campaignLimits.dailyLimit}.`
        : '';

  useEffect(() => {
    if (step !== 2) return;

    if (campaignLimitExceeded) {
      toast.error('❌ Max 100 recipients per campaign', {
        toastId: 'campaign-limit-max-100',
      });
    }

    if (dailyLimitExceeded) {
      toast.error(`❌ Daily limit: ${campaignLimits.dailyLimit} emails reached`, {
        toastId: 'campaign-limit-daily-450',
      });
    }
  }, [
    step,
    campaignLimitExceeded,
    dailyLimitExceeded,
    campaignLimits.dailyLimit,
  ]);

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
        attachResume: hasResume ? form.attachResume : false,
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
        ? hasAudienceInput && !audienceLimitError
        : step === 3
          ? form.body.trim().length > 0
          : step === 4
            ? previewRecipients.length > 0
            : true;

  function handleNextStep() {
    setError('');
    if (step === 2) {
      if (campaignLimitExceeded) {
        toast.error('❌ Max 100 recipients per campaign', {
          toastId: 'campaign-limit-max-100',
        });
      }
      if (dailyLimitExceeded) {
        toast.error(`❌ Daily limit: ${campaignLimits.dailyLimit} emails reached`, {
          toastId: 'campaign-limit-daily-450',
        });
      }
      if (audienceLimitError) {
        setError(audienceLimitError);
        return;
      }
    }
    next();
  }

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
            action={
              step === 2 ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-right text-sm text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
                  <p className="font-semibold">🚀 Campaign Limits</p>
                  <p>Max: 100 per campaign • 450/day</p>
                </div>
              ) : null
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
              {(audienceLimitError || selectedRecipientsCount > 0) && (
                <div className={cn(
                  'rounded-lg px-4 py-3 text-sm',
                  audienceLimitError
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200',
                )}>
                  <p>
                    Selected: {selectedRecipientsCount} • Remaining today: {campaignLimits.remainingToday} / {campaignLimits.dailyLimit}
                  </p>
                  {audienceLimitError ? <p className="mt-1 font-medium">{audienceLimitError}</p> : null}
                </div>
              )}

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
                      <div className="w-full max-w-[220px]">
                        <Select
                          id="contactBatch"
                          value={selectedContactBatch}
                          onChange={(e) => selectContactBatch(e.target.value)}
                          disabled={!contactBatchOptions.length}
                        >
                          <option value="">Select client batch</option>
                          {contactBatchOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                          <option value={CUSTOM_BATCH_VALUE}>Custom range</option>
                        </Select>
                      </div>
                    </div>

                    {selectedContactBatch === CUSTOM_BATCH_VALUE && (
                      <div className="rounded-xl border border-surface-border bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                          Enter custom range (max 100 contacts)
                        </p>
                        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                          <Input
                            type="number"
                            min={1}
                            max={activeContacts.length || 1}
                            placeholder="Start (e.g. 101)"
                            value={customRangeStart}
                            onChange={(e) => setCustomRangeStart(e.target.value)}
                          />
                          <Input
                            type="number"
                            min={1}
                            max={activeContacts.length || 1}
                            placeholder="End (e.g. 180)"
                            value={customRangeEnd}
                            onChange={(e) => setCustomRangeEnd(e.target.value)}
                          />
                          <Button type="button" variant="secondary" onClick={applyCustomRange}>
                            Apply
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="max-h-80 overflow-auto rounded-xl border border-surface-border bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-950/40">
                      {contactsLoading ? (
                        <div className="px-3 py-6 text-sm text-slate-500">Loading contacts...</div>
                      ) : filteredContacts.length === 0 ? (
                        <div className="px-3 py-6 text-sm text-slate-500">No contacts found.</div>
                      ) : (
                        <div className="space-y-2">
                          {step2Contacts.map((contact) => {
                            const checked = selectedContactIds.includes(contact.id);
                            const serialNo = filteredContactSerialMap.get(contact.id);
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
                                <div className="flex items-center gap-2 pt-0.5">
                                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                                    {serialNo}
                                  </span>
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    checked={checked}
                                    onChange={() => toggleContact(contact.id)}
                                  />
                                </div>
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
                    description="Add named clients and optionally capture their company name. New clients are always included when sending this campaign."
                  />
                  <div className="space-y-3">
                    {manualClients.length === 0 && (
                      <p className="text-sm text-slate-500">No manual clients yet. Add one to continue.</p>
                    )}
                    {manualClients.map((client, index) => (
                      <div key={client.id} className="rounded-xl border border-surface-border p-3 dark:border-slate-700">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <Label htmlFor={`client-name-${index}`}>Name</Label>
                            <Input id={`client-name-${index}`} value={client.name} onChange={(e) => updateManualClient(index, 'name', e.target.value)} placeholder="Client name" />
                          </div>
                          <div>
                            <Label htmlFor={`client-company-${index}`}>Company name</Label>
                            <Input id={`client-company-${index}`} value={client.company} onChange={(e) => updateManualClient(index, 'company', e.target.value)} placeholder="Optional" />
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
                          {recipient.company ? (
                            <p className="text-slate-600 dark:text-slate-300">{recipient.company}</p>
                          ) : null}
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

              {hasResume ? (
                <label className="flex items-start gap-3 rounded-xl border border-surface-border bg-app-surface p-4">
                  <input
                    type="checkbox"
                    checked={form.attachResume}
                    onChange={(e) => update('attachResume', e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-input-border"
                  />
                  <span>
                    <span className="block text-sm font-medium text-app">Attach my resume</span>
                    <span className="block text-xs text-app-muted">
                      Sends the resume on file with every email in this campaign.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="rounded-xl border border-dashed border-surface-border p-4 text-xs text-app-muted">
                  No resume on file, so nothing will be attached.{' '}
                  <Link to="/app/resume" className="font-medium text-primary hover:underline">
                    Add one
                  </Link>{' '}
                  to enable this.
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-6">
            <Button type="button" variant="secondary" onClick={back} disabled={step === 1}>
              Back
            </Button>
            <div className="flex gap-3">
              {step < 5 ? (
                <Button type="button" onClick={handleNextStep} disabled={!canNext}>
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
