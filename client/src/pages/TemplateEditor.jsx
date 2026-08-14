import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Label, TextArea } from "../components/ui/Input";
import HtmlPreview, { HtmlViewModeToggle } from "../components/HtmlPreview";
import { PageLoader } from "../components/ui/LoadingSpinner";
import ProviderBadge from "../components/ui/ProviderBadge";
import TemplateChat from "../components/templates/TemplateChat";
import { insertSignature, insertProjectsSection, hasSignatureBlock, hasProjectsBlock } from "../utils/emailSignature";
import { api } from "../services/api";

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyView, setBodyView] = useState("edit");

  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [followUpMode, setFollowUpMode] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [generationCount, setGenerationCount] = useState(0);
  const [aiProvider, setAiProvider] = useState(null);
  const [usedResume, setUsedResume] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sourced from My Resume so the same profile/project links used elsewhere
  // in the app can be inserted here without retyping them.
  const [senderName, setSenderName] = useState("");
  const [resumeLinks, setResumeLinks] = useState(null);
  const [projectLinks, setProjectLinks] = useState([]);

  useEffect(() => {
    api
      .get("/resumes/me")
      .then(({ data }) => {
        setResumeLinks(data.resume?.links || null);
        setProjectLinks(data.resume?.projectLinks || []);
      })
      .catch(() => {});
    api
      .get("/users/me/settings")
      .then(({ data }) => {
        const address = (data.smtpUser || "").trim() || (data.email || "").trim();
        const displayName =
          (data.smtpFromDisplayName || "").trim() ||
          (data.name || "").trim() ||
          address.split("@")[0] ||
          "";
        setSenderName(displayName);
      })
      .catch(() => {});
  }, []);

  const hasAnyProfileLink = Boolean(
    resumeLinks && Object.values(resumeLinks).some((v) => (v || "").trim()),
  );

  function handleInsertSignature() {
    if (!hasAnyProfileLink) {
      toast.info("Add LinkedIn, GitHub, etc. under My Resume first.");
      return;
    }
    setBody((prev) => insertSignature(prev, senderName, resumeLinks));
    setBodyView("edit");
    toast.success(hasSignatureBlock(body) ? "Signature updated." : "Signature inserted.");
  }

  function handleInsertProjects() {
    if (!projectLinks.length) {
      toast.info("Add project links under My Resume first.");
      return;
    }
    setBody((prev) => insertProjectsSection(prev, projectLinks));
    setBodyView("edit");
    toast.success(hasProjectsBlock(body) ? "Project links updated." : "Project links inserted.");
  }

  const loadTemplate = useCallback(async () => {
    if (!isEdit) return;

    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/templates");
      const match = (data.templates || []).find(
        (row) => String(row._id) === String(id),
      );
      if (!match) {
        setError("Template not found.");
        return;
      }
      setName(match.name || "");
      setSubject(match.subject || "");
      setBody(match.body || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  async function handleGenerateAi() {
    if (!aiPrompt.trim()) {
      setAiError("Please paste a JD or clear instruction first.");
      return;
    }

    setAiLoading(true);
    setAiError("");
    setError("");

    try {
      const promptInput = aiPrompt.trim();
      const prompt =
        followUpMode && (subject.trim() || body.trim())
          ? `Follow-up request:\n${promptInput}\n\nCurrent template subject:\n${subject || "(empty)"}\n\nCurrent template body:\n${body || "(empty)"}\n\nUpdate the existing template based on this follow-up request.`
          : promptInput;

      const { data } = await api.post("/templates/ai-generate", { prompt });

      setSubject(typeof data?.subject === "string" ? data.subject : "");
      setBody(typeof data?.body === "string" ? data.body : "");
      if (!name.trim()) setName("AI Generated Template");
      setBodyView("edit");
      setLastPrompt(promptInput);
      setGenerationCount((n) => n + 1);
      setAiProvider(data?.provider || null);
      setUsedResume(Boolean(data?.usedResume));
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Could not generate template",
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;

    setSaving(true);
    setError("");

    try {
      if (isEdit) {
        await api.patch(`/templates/${id}`, {
          name: name.trim(),
          subject: subject.trim(),
          body: body.trim(),
        });
      } else {
        await api.post("/templates", {
          name: name.trim(),
          subject: subject.trim(),
          body: body.trim(),
        });
      }
      navigate("/app/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        to="/app/templates"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        {"<- Back to templates"}
      </Link>

      {error ? (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <Card>
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isEdit ? "Edit template" : "New template"}
            </h3>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-[170px]"
              onClick={(e) => {
                e.preventDefault();
                setAiEnabled((v) => !v);
              }}
            >
              {aiEnabled ? "Hide AI panel" : "Customize with AI"}
            </Button>
          </div>
          {!isEdit ? (
            <div className="mt-2 rounded-xl border border-surface-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  You can personalize with{" "}
                  <span className="font-semibold text-brand-700 dark:text-brand-300">
                    {"{{name}}"}
                  </span>
                  ,{" "}
                  <span className="font-semibold text-brand-700 dark:text-brand-300">
                    {"{{first_name}}"}
                  </span>
                  ,{" "}
                  <span className="font-semibold text-brand-700 dark:text-brand-300">
                    {"{{email}}"}
                  </span>
                  , and{" "}
                  <span className="font-semibold text-brand-700 dark:text-brand-300">
                    {"{{company}}"}
                  </span>
                  .
                </p>
                <span className="inline-flex items-center gap-1 rounded-full border border-[color:rgba(var(--secondary-rgb),0.45)] bg-[color:rgba(var(--secondary-rgb),0.14)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--secondary)]">
                  <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                  </span>
                  New
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {aiEnabled ? (
          <div className="mb-4 rounded-xl border border-surface-border bg-surface-muted/40 p-4">
            <Label htmlFor="ai-prompt">AI Prompt Box</Label>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
              <span className="rounded-full bg-brand-100 px-2 py-1 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                Initial prompt
              </span>
              <span className="rounded-full bg-cyan-100 px-2 py-1 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                Follow-up prompt
              </span>
            </div>
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
              Use this same box for both JD input and follow-up questions. For follow-up, turn on Follow-up mode and write what to change.
            </p>
            <label className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={followUpMode}
                onChange={(e) => setFollowUpMode(e.target.checked)}
              />
              Follow-up mode (update current Subject + Body)
            </label>
            {generationCount > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Last AI update applied. Ask your follow-up below and generate again.
                </p>
                <ProviderBadge provider={aiProvider} />
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    usedResume
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                  title={
                    usedResume
                      ? 'Your saved resume was used to personalise this template'
                      : 'Add a resume under My Resume to personalise future templates'
                  }
                >
                  {usedResume ? 'Personalised from your resume' : 'No resume on file'}
                </span>
              </div>
            ) : null}
            <TextArea
              id="ai-prompt"
              rows={6}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={
                followUpMode
                  ? "Example follow-up: Keep same structure, add Kubernetes and Redis, and make tone more concise."
                  : "Paste JD / instruction here..."
              }
            />
            {lastPrompt ? (
              <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                Previous prompt: {lastPrompt}
              </p>
            ) : null}
            {aiError ? (
              <p className="mt-2 text-xs font-medium text-rose-700">
                {aiError}
              </p>
            ) : null}
            <div className="mt-3">
              <Button
                type="button"
                onClick={() => void handleGenerateAi()}
                disabled={aiLoading}
              >
                {aiLoading ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tpl-name">Template Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Welcome email"
              required
            />
          </div>
          <div>
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Welcome to {{company}}"
              required
            />
          </div>
          <div>
            <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="tpl-body" className="mb-0">
                Body (HTML)
              </Label>
              <HtmlViewModeToggle value={bodyView} onChange={setBodyView} />
            </div>
            {bodyView === "edit" ? (
              <TextArea
                id="tpl-body"
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="<p>Hi there,</p><p>...</p>"
              />
            ) : (
              <HtmlPreview
                html={body}
                minHeight="320px"
                emptyMessage="Switch to Edit HTML and add markup to see a preview."
              />
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleInsertSignature}
                disabled={!hasAnyProfileLink}
                title={hasAnyProfileLink ? "" : "Add profile links under My Resume first"}
              >
                {hasSignatureBlock(body) ? "Update signature" : "Insert signature"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleInsertProjects}
                disabled={!projectLinks.length}
                title={projectLinks.length ? "" : "Add project links under My Resume first"}
              >
                {hasProjectsBlock(body) ? "Update project links" : "Insert project links"}
              </Button>
              {(!hasAnyProfileLink || !projectLinks.length) && (
                <Link to="/app/resume" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                  Add links under My Resume
                </Link>
              )}
            </div>
          </div>

          <TemplateChat
            getSubject={() => subject}
            getBody={() => body}
            onApply={(newSubject, newBody) => {
              setSubject(newSubject);
              setBody(newBody);
              setBodyView("edit");
            }}
          />

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
            <Link to="/app/templates">
              <Button type="button" variant="secondary" disabled={saving}>
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
