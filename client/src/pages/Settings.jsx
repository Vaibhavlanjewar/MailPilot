import { useCallback, useEffect, useState } from "react";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Label } from "../components/ui/Input";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSmtpAppPassword, setHasSmtpAppPassword] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpFromDisplayName, setSmtpFromDisplayName] = useState("");
  const [smtpAppPassword, setSmtpAppPassword] = useState("");
  const [banner, setBanner] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const { data } = await api.get("/users/me/settings");
      setHasSmtpAppPassword(Boolean(data.hasSmtpAppPassword));
      setSmtpUser(data.smtpUser?.trim() || data.email || "");
      setSmtpFromDisplayName(
        data.smtpFromDisplayName?.trim() || data.name || "",
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

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const payload = {
        smtpUser: smtpUser.trim() === "" ? "" : smtpUser.trim().toLowerCase(),
        smtpFromDisplayName: smtpFromDisplayName.trim(),
      };
      if (smtpAppPassword.trim() !== "") {
        payload.smtpAppPassword = smtpAppPassword;
      }
      const { data } = await api.patch("/users/me/settings", payload);
      setHasSmtpAppPassword(Boolean(data.hasSmtpAppPassword));
      setSmtpUser(data.smtpUser?.trim() || data.email || "");
      setSmtpFromDisplayName(
        data.smtpFromDisplayName?.trim() || data.name || "",
      );
      setSmtpAppPassword("");
      setBanner({
        type: "success",
        text: "SMTP settings saved. Campaigns use these credentials",
      });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Save failed.",
      });
    }
    setSaving(false);
  }

  async function handleClearPassword() {
    setSmtpAppPassword("");
    setSaving(true);
    setBanner(null);
    try {
      const { data } = await api.patch("/users/me/settings", {
        smtpAppPassword: "",
      });
      setHasSmtpAppPassword(Boolean(data.hasSmtpAppPassword));
      setBanner({ type: "success", text: "Stored app password removed." });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not clear password.",
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
        <CardHeader title="SMTP & sender" />

        <div style={{ marginTop: "10px" }}>
          <a
            href="https://www.youtube.com/watch?v=I9x0w8cjR_o"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#3b82f6", textDecoration: "underline" }}
          >
            How to generate Gmail App Password (Watch Video)
          </a>
        </div>
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
            <Label htmlFor="smtpUser">SMTP user (Gmail address)</Label>
            <Input
              id="smtpUser"
              type="email"
              autoComplete="username"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder={user?.email || "you@gmail.com"}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Same as the Google account for your app password. Leave empty to
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
              placeholder="e.g. MailChips"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Recipients see: <strong>Sender name</strong> &lt;SMTP user&gt;
            </p>
          </div>

          <div>
            <Label htmlFor="appPass">Gmail app password</Label>
            <Input
              id="appPass"
              type="password"
              autoComplete="new-password"
              value={smtpAppPassword}
              onChange={(e) => setSmtpAppPassword(e.target.value)}
              placeholder="16-character app password (leave blank to keep saved)"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Google Account → Security → 2-Step Verification → App passwords.
            </p>
            {hasSmtpAppPassword ? (
              <p className="mt-2 text-xs font-medium text-emerald-800">
                A password is on file. Enter a new one only to replace it.
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-800">
                Save an app password here so sends do not rely on server .env.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save SMTP settings"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving || !hasSmtpAppPassword}
              onClick={handleClearPassword}
            >
              Remove stored password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
