import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Label } from "../components/ui/Input";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [hasGmailRefreshToken, setHasGmailRefreshToken] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpFromDisplayName, setSmtpFromDisplayName] = useState("");
  const [banner, setBanner] = useState(null);

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
      setHasGmailRefreshToken(Boolean(data.hasGmailRefreshToken));
      setSmtpUser(data.smtpUser?.trim() || data.email || "");
      setSmtpFromDisplayName(
        data.smtpFromDisplayName?.trim() || gmailFallbackName(data.smtpUser || data.email) || data.name || "",
      );
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

  async function handleConnectGmail() {
    setConnectingGmail(true);
    setBanner(null);
    try {
      const { data } = await api.get("/users/me/gmail/connect-url");
      if (!data?.url) {
        throw new Error("Could not get Gmail connect URL.");
      }
      window.location.assign(data.url);
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Gmail connect failed.",
      });
      setConnectingGmail(false);
    }
  }

  async function handleDisconnectGmail() {
    setSaving(true);
    setBanner(null);
    try {
      const { data } = await api.patch("/users/me/settings", {
        gmailRefreshToken: "",
      });
      setHasGmailRefreshToken(Boolean(data.hasGmailRefreshToken));
      setBanner({ type: "success", text: "Gmail connection removed." });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not disconnect Gmail.",
      });
    }
    setSaving(false);
  }

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
        <CardHeader title="Gmail API" />
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Connect your Gmail once to send campaigns without entering app
          passwords. Each user links their own Gmail account.
        </p>
        {hasGmailRefreshToken ? (
          <p className="mb-4 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Gmail is connected for this account.
          </p>
        ) : (
          <p className="mb-4 text-sm text-amber-800 dark:text-amber-300">
            Gmail is not connected. Click connect before sending campaigns.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={handleConnectGmail}
            disabled={connectingGmail || saving}
          >
            {connectingGmail ? "Redirecting…" : "Connect Gmail"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving || !hasGmailRefreshToken}
            onClick={handleDisconnectGmail}
          >
            Disconnect Gmail
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Sender" description="If you leave the sender name blank, we will use the Gmail name before the @ symbol." />
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
    </div>
  );
}
