import { useCallback, useEffect, useMemo, useState } from "react";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Label } from "../components/ui/Input";
import DataTable from "../components/ui/DataTable";
import { PageLoader } from "../components/ui/LoadingSpinner";
import { api } from "../services/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 10;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function makeEditDraft(contact) {
  return {
    name: contact?.name || "",
    email: contact?.email || "",
    company: contact?.company || "",
  };
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
  const [draftContacts, setDraftContacts] = useState([{ name: "", email: "", company: "" }]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [toggleBusyId, setToggleBusyId] = useState("");
  const [editContact, setEditContact] = useState(null);
  const [editDraft, setEditDraft] = useState(makeEditDraft(null));
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [error, setError] = useState(null);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const name = String(row.name || "").toLowerCase();
      const email = String(row.email || "").toLowerCase();
      const company = String(row.company || "").toLowerCase();
      return name.includes(query) || email.includes(query) || company.includes(query);
    });
  }, [rows, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const existingEmailSet = useMemo(
    () => new Set(rows.map((row) => normalizeEmail(row.email)).filter(Boolean)),
    [rows],
  );
  const existingNameSet = useMemo(
    () => new Set(rows.map((row) => normalizeName(row.name)).filter(Boolean)),
    [rows],
  );
  const selectedCount = selectedIds.length;
  const currentPageSelected =
    paginatedRows.length > 0 && paginatedRows.every((row) => selectedSet.has(row.id));

  const columns = useMemo(
    () => [
      {
        key: "select",
        header: (
          <input
            type="checkbox"
            aria-label="Select contacts on this page"
            checked={currentPageSelected}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  paginatedRows.forEach((row) => next.add(row.id));
                  return Array.from(next);
                });
                return;
              }

              setSelectedIds((prev) =>
                prev.filter((id) => !paginatedRows.some((row) => row.id === id)),
              );
            }}
            className="h-4 w-4 rounded border-[#64748b] bg-transparent text-[#6366f1] focus:ring-[#6366f1]"
          />
        ),
        className: "w-14",
        render: (row) => {
          const selected = selectedSet.has(row.id);
          return (
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
          );
        },
      },
      {
        key: "name",
        header: "Name",
        render: (row) => row.name || "Unnamed contact",
      },
      {
        key: "company",
        header: "Company",
        render: (row) => row.company || "—",
      },
      {
        key: "email",
        header: "Email",
        render: (row) => row.email,
      },
      {
        key: "status",
        header: "Status",
        render: (row) => <StatusBadge subscribed={row.subscribed} />,
      },
      {
        key: "action",
        header: "Action",
        render: (row) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEdit(row)}
              disabled={toggleBusyId === row.id || bulkBusy || editBusy}
            >
              Edit
            </Button>
            <SubscriptionActionButton
              subscribed={row.subscribed}
              busy={toggleBusyId === row.id}
              disabled={toggleBusyId === row.id || bulkBusy || editBusy}
              onClick={() => void handleToggleSubscription(row)}
            />
          </div>
        ),
      },
    ],
    [bulkBusy, currentPageSelected, editBusy, paginatedRows, selectedSet, toggleBusyId],
  );

  const from = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filteredRows.length);

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

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function handleToggleSubscription(row) {
    const nextSubscribed = !row.subscribed;
    setToggleBusyId(row.id);
    setError(null);
    setRows((current) =>
      current.map((contact) =>
        contact.id === row.id ? { ...contact, subscribed: nextSubscribed } : contact,
      ),
    );
    try {
      await api.patch(`/contacts/${row.id}/subscription`, {
        subscribed: nextSubscribed,
      });
    } catch (err) {
      setRows((current) =>
        current.map((contact) =>
          contact.id === row.id ? { ...contact, subscribed: row.subscribed } : contact,
        ),
      );
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setToggleBusyId("");
    }
  }

  function handleOpenEdit(row) {
    setEditContact(row);
    setEditDraft(makeEditDraft(row));
    setEditError("");
  }

  function handleCloseEdit() {
    if (editBusy) return;
    setEditContact(null);
    setEditDraft(makeEditDraft(null));
    setEditError("");
  }

  async function handleSaveEdit() {
    if (!editContact || editBusy) return;

    const nextEmail = typeof editDraft.email === "string" ? editDraft.email.trim().toLowerCase() : "";
    const nextName = typeof editDraft.name === "string" ? editDraft.name.trim() : "";
    const nextCompany = typeof editDraft.company === "string" ? editDraft.company.trim() : "";

    if (!nextEmail || !EMAIL_RE.test(nextEmail)) {
      setEditError("Enter a valid email address.");
      return;
    }

    setEditBusy(true);
    setEditError("");

    const previousRow = editContact;
    const optimisticRow = {
      ...previousRow,
      email: nextEmail,
      name: nextName,
      company: nextCompany,
    };

    setRows((current) =>
      current.map((contact) => (contact.id === previousRow.id ? optimisticRow : contact)),
    );

    try {
      const { data } = await api.patch(`/contacts/${previousRow.id}`, {
        email: nextEmail,
        name: nextName,
        company: nextCompany,
      });

      const updated = data.contact || optimisticRow;
      setRows((current) =>
        current.map((contact) => (contact.id === previousRow.id ? { ...contact, ...updated } : contact)),
      );
      setEditContact(null);
      setEditDraft(makeEditDraft(null));
    } catch (err) {
      setRows((current) =>
        current.map((contact) => (contact.id === previousRow.id ? previousRow : contact)),
      );
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditBusy(false);
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
    setDraftContacts((prev) => [...prev, { name: "", email: "", company: "" }]);
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
          company: typeof row.company === "string" ? row.company.trim() : "",
        })),
      });
      await load();
      setDraftContacts([{ name: "", email: "", company: "" }]);
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                    <Label htmlFor={`client-company-${index}`}>Company name</Label>
                    <Input
                      id={`client-company-${index}`}
                      type="text"
                      placeholder="Optional"
                      value={contact.company}
                      onChange={(e) =>
                        handleDraftChange(index, "company", e.target.value)
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
              placeholder="Search by name, email, or company"
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
        <DataTable
          columns={columns}
          rows={paginatedRows}
          loading={loading}
          emptyMessage="No contacts yet. Upload a CSV or add them when creating a campaign."
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app bg-app-surface p-4 text-sm text-app-muted">
          <p>
            Showing {from}-{to} of {filteredRows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="min-w-20 text-center text-app">
              Page {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {editContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <Card className="w-full max-w-lg">
            <CardHeader
              title="Edit contact"
              description="Update the contact's name, company, or email."
            />

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSaveEdit();
              }}
            >
              {editError && (
                <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {editError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-contact-name">Name</Label>
                  <Input
                    id="edit-contact-name"
                    value={editDraft.name}
                    onChange={(e) =>
                      setEditDraft((current) => ({
                        ...current,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Client name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-contact-company">Company name</Label>
                  <Input
                    id="edit-contact-company"
                    value={editDraft.company}
                    onChange={(e) =>
                      setEditDraft((current) => ({
                        ...current,
                        company: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-contact-email">Email</Label>
                  <Input
                    id="edit-contact-email"
                    type="email"
                    value={editDraft.email}
                    onChange={(e) =>
                      setEditDraft((current) => ({
                        ...current,
                        email: e.target.value,
                      }))
                    }
                    placeholder="client@example.com"
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseEdit}
                  disabled={editBusy}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={editBusy}>
                  {editBusy ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
