import { useCallback, useEffect, useMemo, useState } from "react";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Label } from "../components/ui/Input";
import { PageLoader } from "../components/ui/LoadingSpinner";
import { api } from "../services/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function StatusBadge({ subscribed }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        subscribed
          ? "bg-cyan-500/20 text-cyan-300"
          : "bg-[#475569] text-slate-200",
      ].join(" ")}
    >
      {subscribed ? "Subscribed" : "Unsubscribed"}
    </span>
  );
}

function SubscriptionActionButton({ subscribed, busy, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold",
        "transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
        subscribed
          ? "border border-[#6366f1] bg-transparent text-indigo-300 hover:bg-[#6366f1] hover:text-white"
          : "bg-gradient-to-r from-[#6366f1] to-[#06b6d4] text-white shadow-[0_0_20px_rgba(6,182,212,0.28)] hover:brightness-110",
      ].join(" ")}
    >
      {busy ? "Saving..." : subscribed ? "Disable" : "Enable"}
    </button>
  );
}

export default function Contacts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [draftContacts, setDraftContacts] = useState([{ name: "", email: "" }]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [toggleBusyId, setToggleBusyId] = useState("");
  const [error, setError] = useState(null);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const name = String(row.name || "").toLowerCase();
      const email = String(row.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [rows, searchTerm]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const existingEmailSet = useMemo(
    () => new Set(rows.map((row) => normalizeEmail(row.email)).filter(Boolean)),
    [rows],
  );
  const existingNameSet = useMemo(
    () => new Set(rows.map((row) => normalizeName(row.name)).filter(Boolean)),
    [rows],
  );
  const allVisibleSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedSet.has(row.id));
  const selectedCount = selectedIds.length;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/contacts");
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

  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => rows.some((row) => row.id === id)),
    );
  }, [rows]);

  async function handleToggleSubscription(row) {
    setToggleBusyId(row.id);
    setError(null);
    try {
      await api.patch(`/contacts/${row.id}/subscription`, {
        subscribed: !row.subscribed,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setToggleBusyId("");
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/contacts/upload", formData);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  }

  function handleDraftChange(index, field, value) {
    setDraftContacts((prev) =>
      prev.map((contact, i) =>
        i === index
          ? {
              ...contact,
              [field]: value,
            }
          : contact,
      ),
    );
  }

  function handleAddDraft() {
    setDraftContacts((prev) => [...prev, { name: "", email: "" }]);
  }

  function handleRemoveDraft(index) {
    setDraftContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateContacts() {
    setError(null);
    const duplicateExistingEmails = new Set();
    const duplicateExistingNames = new Set();
    const duplicateDraftEmails = new Set();
    const duplicateDraftNames = new Set();
    const invalidEmails = [];
    const seenDraftEmails = new Set();
    const seenDraftNames = new Set();

    for (const row of draftContacts) {
      const email = normalizeEmail(row.email);
      const name = normalizeName(row.name);

      if (!email || !EMAIL_RE.test(email)) {
        if (email) invalidEmails.push(row.email);
        continue;
      }

      if (existingEmailSet.has(email)) {
        duplicateExistingEmails.add(email);
      }
      if (seenDraftEmails.has(email)) {
        duplicateDraftEmails.add(email);
      }
      seenDraftEmails.add(email);

      if (name) {
        if (existingNameSet.has(name)) {
          duplicateExistingNames.add(name);
        }
        if (seenDraftNames.has(name)) {
          duplicateDraftNames.add(name);
        }
        seenDraftNames.add(name);
      }
    }

    const errorLines = [];
    if (duplicateExistingNames.size) {
      errorLines.push(
        `Name already present in client list: ${Array.from(duplicateExistingNames).join(", ")}`,
      );
    }
    if (duplicateExistingEmails.size) {
      errorLines.push(
        `Email already present in client list: ${Array.from(duplicateExistingEmails).join(", ")}`,
      );
    }
    if (duplicateDraftNames.size) {
      errorLines.push(
        `Duplicate names in added clients: ${Array.from(duplicateDraftNames).join(", ")}`,
      );
    }
    if (duplicateDraftEmails.size) {
      errorLines.push(
        `Duplicate emails in added clients: ${Array.from(duplicateDraftEmails).join(", ")}`,
      );
    }
    if (invalidEmails.length) {
      errorLines.push("One or more client emails are invalid.");
    }

    if (errorLines.length) {
      setError(new Error(errorLines.join(". ")));
      return;
    }

    setCreateBusy(true);
    try {
      await api.post("/contacts/bulk", {
        contacts: draftContacts.map((row) => ({
          name: typeof row.name === "string" ? row.name.trim() : "",
          email: typeof row.email === "string" ? row.email.trim() : "",
        })),
      });
      await load();
      setDraftContacts([{ name: "", email: "" }]);
      setShowManualAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleBulkSubscription(subscribed) {
    setBulkBusy(true);
    setError(null);
    try {
      const targets = rows.filter(
        (row) => selectedSet.has(row.id) && row.subscribed !== subscribed,
      );
      if (!targets.length) {
        setBulkBusy(false);
        return;
      }

      await Promise.all(
        targets.map((row) =>
          api.patch(`/contacts/${row.id}/subscription`, {
            subscribed,
          }),
        ),
      );
      await load();
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setBulkBusy(false);
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => load()}
              >
                Refresh list
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowManualAdd((prev) => !prev)}
              >
                {showManualAdd ? "Close add client" : "Add client"}
              </Button>
            </div>
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
              {uploadBusy ? "Uploading…" : "Upload CSV"}
            </span>
          </label>
          <p className="text-sm text-slate-500">
            Files are sent to the server and merged with your list.
          </p>
        </div>

        {showManualAdd && (
          <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            {draftContacts.map((contact, index) => (
              <div
                key={`contact-${index}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">
                    Client {index + 1}
                  </p>
                  {draftContacts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDraft(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`client-name-${index}`}>Name</Label>
                    <Input
                      id={`client-name-${index}`}
                      type="text"
                      placeholder="Optional"
                      value={contact.name}
                      onChange={(e) =>
                        handleDraftChange(index, "name", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`client-email-${index}`}>Email</Label>
                    <Input
                      id={`client-email-${index}`}
                      type="email"
                      placeholder="client@example.com"
                      value={contact.email}
                      onChange={(e) =>
                        handleDraftChange(index, "email", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddDraft}
              >
                Add more client
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={createBusy}
                onClick={() => void handleCreateContacts()}
              >
                {createBusy
                  ? "Saving…"
                  : draftContacts.length === 1
                    ? "Save client"
                    : `Save ${draftContacts.length} clients`}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:w-72">
            <Label htmlFor="contact-search" className="mb-1">
              Search
            </Label>
            <Input
              id="contact-search"
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">
              {selectedCount
                ? `${selectedCount} selected`
                : "No contacts selected"}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedCount || bulkBusy}
              onClick={() => void handleBulkSubscription(true)}
            >
              {bulkBusy ? "Working…" : "Bulk Enable"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedCount || bulkBusy}
              onClick={() => void handleBulkSubscription(false)}
            >
              {bulkBusy ? "Working…" : "Bulk Disable"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!selectedCount || bulkBusy}
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-t-2xl border border-[#334155] bg-[#0f172a] shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)] font-sans">
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-left text-sm text-[#e2e8f0]">
              <thead className="sticky top-0 z-10 bg-[#e5e7eb] text-[#1e293b]">
                <tr>
                  <th className="w-14 px-6 py-4 font-bold text-black">
                    <input
                      type="checkbox"
                      aria-label="Select all contacts"
                      checked={allVisibleSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            filteredRows.forEach((row) => next.add(row.id));
                            return Array.from(next);
                          });
                          return;
                        }
                        setSelectedIds((prev) =>
                          prev.filter((id) => !filteredRows.some((row) => row.id === id)),
                        );
                      }}
                      className="h-4 w-4 rounded border-[#64748b] bg-transparent text-[#6366f1] focus:ring-[#6366f1]"
                    />
                  </th>
                  <th className="px-6 py-4 font-bold text-black">Name</th>
                  <th className="px-6 py-4 font-bold text-black">Email</th>
                  <th className="px-6 py-4 font-bold text-black">Status</th>
                  <th className="px-6 py-4 font-bold text-black">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length > 0 &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={`skeleton-${i}`} className="border-t border-[#334155] bg-[#1e293b]">
                      <td className="px-6 py-4">
                        <div className="h-4 w-4 animate-pulse rounded bg-[#334155]" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-28 animate-pulse rounded bg-[#334155]" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-44 animate-pulse rounded bg-[#334155]" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 w-24 animate-pulse rounded-full bg-[#334155]" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-8 w-20 animate-pulse rounded-full bg-[#334155]" />
                      </td>
                    </tr>
                  ))}

                {!loading && filteredRows.length === 0 && (
                  <tr className="border-t border-[#334155] bg-[#1e293b]">
                    <td className="px-6 py-10 text-center text-[#cbd5f5]" colSpan={5}>
                      No contacts yet. Upload a CSV or add them when creating a campaign.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRows.map((row) => {
                    const selected = selectedSet.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={[
                          "border-t border-[#334155] bg-[#1e293b] transition-colors duration-150",
                          selected ? "bg-[#273449]" : "hover:bg-[#273449]",
                        ].join(" ")}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Select ${row.email}`}
                            checked={selected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds((prev) => [...prev, row.id]);
                                return;
                              }
                              setSelectedIds((prev) => prev.filter((id) => id !== row.id));
                            }}
                            className="h-4 w-4 rounded border-[#64748b] bg-transparent text-[#6366f1] focus:ring-[#6366f1]"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-[#e2e8f0]">
                          {row.name || "Unnamed contact"}
                        </td>
                        <td className="px-6 py-4 text-[#cbd5f5]">{row.email}</td>
                        <td className="px-6 py-4">
                          <StatusBadge subscribed={row.subscribed} />
                        </td>
                        <td className="px-6 py-4">
                          <SubscriptionActionButton
                            subscribed={row.subscribed}
                            busy={toggleBusyId === row.id}
                            disabled={toggleBusyId === row.id || bulkBusy}
                            onClick={() => void handleToggleSubscription(row)}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
