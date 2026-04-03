import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "../components/ui/DataTable";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Label } from "../components/ui/Input";
import Badge from "../components/ui/Badge";
import { PageLoader } from "../components/ui/LoadingSpinner";
import { api } from "../services/api";

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

  const columns = [
    {
      key: "select",
      header: (
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
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
      ),
      className: "w-12",
      render: (row) => (
        <input
          type="checkbox"
          aria-label={`Select ${row.email}`}
          checked={selectedSet.has(row.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds((prev) => [...prev, row.id]);
              return;
            }
            setSelectedIds((prev) => prev.filter((id) => id !== row.id));
          }}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
      ),
    },
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    {
      key: "subscribed",
      header: "Status",
      render: (row) => (
        <Badge variant={row.subscribed ? "active" : "inactive"}>
          {row.subscribed ? "Subscribed" : "Unsubscribed"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Action",
      render: (row) => (
        <Button
          type="button"
          variant={row.subscribed ? "secondary" : "primary"}
          size="sm"
          disabled={toggleBusyId === row.id || bulkBusy}
          onClick={() => void handleToggleSubscription(row)}
        >
          {toggleBusyId === row.id
            ? "Saving…"
            : row.subscribed
              ? "Disable"
              : "Enable"}
        </Button>
      ),
    },
  ];

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
    setCreateBusy(true);
    setError(null);
    try {
      await api.post("/contacts/bulk", {
        contacts: draftContacts,
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
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              All contacts
            </h2>
            <p className="text-sm text-slate-500">
              {filteredRows.length} shown / {rows.length} total
            </p>
          </div>
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
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
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
        <DataTable
          columns={columns}
          rows={filteredRows}
          loading={loading && rows.length > 0}
          emptyMessage="No contacts yet. Upload a CSV or add them when creating a campaign."
        />
      </div>
    </div>
  );
}
