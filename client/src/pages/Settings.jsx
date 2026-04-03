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
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpFromDisplayName, setSmtpFromDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [banner, setBanner] = useState(null);
  const [activeSection, setActiveSection] = useState("");

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

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordSaving(true);
    setBanner(null);
    try {
      await api.patch("/users/me/password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setBanner({ type: "success", text: "Password changed successfully." });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not change password.",
      });
    }
    setPasswordSaving(false);
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

      <Card className={activeSection === "password" ? "ring-2 ring-app-focus" : ""}>
        <CardHeader title="Change password" description="Use your current password to set a new password." />
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
            />
          </div>

          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      </Card>

    </div>
  );
}
