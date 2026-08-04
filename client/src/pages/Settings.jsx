import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Label } from "../components/ui/Input";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user, ready, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpFromDisplayName, setSmtpFromDisplayName] = useState("");
  const [banner, setBanner] = useState(null);
  const [activeSection, setActiveSection] = useState("");

  const [role, setRole] = useState("candidate");
  const [roleSaving, setRoleSaving] = useState(false);
  const [hasGmailRefreshToken, setHasGmailRefreshToken] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);

  function gmailFallbackName(email) {
    const value = typeof email === 'string' ? email.trim() : '';
    if (!value) return '';
    return value.split('@')[0] || '';
  }

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const { data } = await api.get("/users/me/settings");
      setSmtpUser(data.smtpUser?.trim() || data.email || "");
      setSmtpFromDisplayName(
        data.smtpFromDisplayName?.trim() || gmailFallbackName(data.smtpUser || data.email) || data.name || "",
      );
      setHasGmailRefreshToken(Boolean(data.hasGmailRefreshToken));
      setRole(data.role || "candidate");
    } catch (e) {
      setBanner({
        type: "error",
        text: e instanceof Error ? e.message : "Could not load settings.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const gmail = params.get("gmail");
    const message = params.get("message");
    const section = params.get("section") || "";

    setActiveSection(section);
    if (!gmail) return;

    if (gmail === "connected") {
      setBanner({ type: "success", text: "Gmail connected successfully." });
      load();
    } else if (gmail === "error") {
      setBanner({ type: "error", text: message || "Gmail connect failed." });
    }

    params.delete("gmail");
    params.delete("message");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, load]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        smtpUser: smtpUser.trim() === "" ? "" : smtpUser.trim().toLowerCase(),
        smtpFromDisplayName: smtpFromDisplayName.trim(),
      };
      const { data } = await api.patch("/users/me/settings", payload);
      setSmtpUser(data.smtpUser?.trim() || data.email || "");
      setSmtpFromDisplayName(
        data.smtpFromDisplayName?.trim() || gmailFallbackName(data.smtpUser || data.email) || data.name || "",
      );
      setBanner({
        type: "success",
        text: "Sender settings saved. Campaigns use this sender name.",
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Save failed.",
      });
    }
    setSaving(false);
  }

  async function handleRoleChange(nextRole) {
    if (nextRole === role) return;
    setRoleSaving(true);
    setBanner(null);
    try {
      const { data } = await api.patch("/users/me/settings", { role: nextRole });
      setRole(data.role);
      updateUser({ role: data.role });
      setBanner({
        type: "success",
        text:
          data.role === "recruiter"
            ? "Switched to Recruiter — a new Recruiter section is now in your sidebar."
            : "Switched to Candidate.",
      });
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Could not update role." });
    }
    setRoleSaving(false);
  }

  async function handleConnectGmail() {
    setConnectingGmail(true);
    setBanner(null);
    try {
      const { data } = await api.get("/users/me/gmail/connect-url");
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No connect URL returned.");
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Could not start Gmail connect." });
      setConnectingGmail(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader
          title="Account type"
          description="Candidates search and apply to jobs. Recruiters get a Recruiter section to post and manage listings."
        />
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "candidate", label: "Candidate", desc: "Job hunting" },
            { value: "recruiter", label: "Recruiter", desc: "Hiring" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={roleSaving}
              onClick={() => handleRoleChange(opt.value)}
              className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${
                role === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-app hover:border-primary/50"
              }`}
            >
              <p className={`text-sm font-semibold ${role === opt.value ? "text-primary" : "text-app"}`}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Profile" description="Sender details for campaign emails. If sender name is blank, we use the Gmail name before the @ symbol." />
        {banner && (
          <div
            className={
              banner.type === "success"
                ? "mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                : "mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800"
            }
            role="status"
          >
            {banner.text}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <Label htmlFor="smtpUser">Gmail address</Label>
            <Input
              id="smtpUser"
              type="email"
              autoComplete="username"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder={user?.email || "you@gmail.com"}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Same as the Google account used for Gmail sending. Leave empty to
              use your MailPilot login email.
            </p>
          </div>

          <div>
            <Label htmlFor="fromName">Sender name (shown in From)</Label>
            <Input
              id="fromName"
              type="text"
              value={smtpFromDisplayName}
              onChange={(e) => setSmtpFromDisplayName(e.target.value)}
              placeholder={gmailFallbackName(smtpUser || user?.email) || "e.g. MailChips"}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Recipients see: <strong>Sender name</strong> &lt;Gmail address&gt;
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save sender settings"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className={activeSection === "gmail" ? "ring-2 ring-app-focus" : ""}>
        <CardHeader
          title="Email sending"
          description="Connect Gmail so MailPilot can send your campaigns. One click, no password ever touches this app — it grants permission to send only, not to read your mail."
        />

        <div className="rounded-xl border border-app p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-app">Connect Gmail</p>
              <p className="mt-1 text-xs text-slate-500">
                Required before campaigns can send. You can disconnect any time from
                your Google account&apos;s security settings.
              </p>
            </div>
            {hasGmailRefreshToken ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                Connected
              </span>
            ) : (
              <Button type="button" onClick={handleConnectGmail} disabled={connectingGmail}>
                {connectingGmail ? "Redirecting…" : "Connect Gmail"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
