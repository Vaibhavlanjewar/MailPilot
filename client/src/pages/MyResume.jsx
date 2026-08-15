import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { extractTextFromFile, ACCEPTED_RESUME_TYPES } from '../services/documentText';

const MAX_BYTES = 2 * 1024 * 1024;
const EMPTY_LINKS = { linkedin: '', github: '', portfolio: '', leetcode: '' };
const LINK_FIELDS = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/you' },
  { key: 'portfolio', label: 'Portfolio', placeholder: 'https://yoursite.com' },
  { key: 'leetcode', label: 'LeetCode', placeholder: 'https://leetcode.com/u/you' },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

export default function MyResume() {
  const location = useLocation();
  const returnTo = location.state?.returnTo || '';
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('upload'); // 'upload' | 'paste'
  const [pasteText, setPasteText] = useState('');
  const [pasteTitle, setPasteTitle] = useState('My resume');

  // Draft copies so editing doesn't touch `resume` (and re-render everything
  // that reads it) until Save is actually pressed.
  const [linksDraft, setLinksDraft] = useState(EMPTY_LINKS);
  const [projectLinksDraft, setProjectLinksDraft] = useState([]);
  const [linksBusy, setLinksBusy] = useState(false);
  const [linksDirty, setLinksDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/resumes/me');
      setResume(data.resume);
      // Only seed drafts from the server on a fresh load, not after every
      // background refetch — otherwise an in-progress edit could be clobbered
      // by a reload triggered elsewhere (e.g. right after re-uploading the
      // resume file itself, which also returns a fresh `resume`).
      setLinksDraft({ ...EMPTY_LINKS, ...(data.resume?.links || {}) });
      setProjectLinksDraft(data.resume?.projectLinks?.length ? data.resume.projectLinks : []);
      setLinksDirty(false);
    } catch (err) {
      toast.error(err.message || 'Could not load your resume.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error('File exceeds the 2MB limit.');
      return;
    }

    setBusy(true);
    try {
      const content = await extractTextFromFile(file);
      // Text drives AI features; the original file is kept for email attachments.
      const fileBase64 = file.name.toLowerCase().endsWith('.txt')
        ? undefined
        : await fileToBase64(file);

      const { data } = await api.put('/resumes/me', {
        title: file.name,
        source: 'upload',
        content,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileBase64,
      });
      setResume(data.resume);
      toast.success(resume ? 'Resume replaced.' : 'Resume saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save the resume.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePaste(e) {
    e.preventDefault();
    if (!pasteText.trim()) {
      toast.info('Paste your resume text first.');
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.put('/resumes/me', {
        title: pasteTitle.trim() || 'My resume',
        source: 'paste',
        content: pasteText,
      });
      setResume(data.resume);
      setPasteText('');
      toast.success('Resume saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save the resume.');
    } finally {
      setBusy(false);
    }
  }

  function updateLink(key, value) {
    setLinksDraft((prev) => ({ ...prev, [key]: value }));
    setLinksDirty(true);
  }

  function updateProjectLink(index, field, value) {
    setProjectLinksDraft((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
    setLinksDirty(true);
  }

  function addProjectLink() {
    if (projectLinksDraft.length >= 10) {
      toast.info('Up to 10 project links.');
      return;
    }
    setProjectLinksDraft((prev) => [...prev, { title: '', url: '' }]);
    setLinksDirty(true);
  }

  function removeProjectLink(index) {
    setProjectLinksDraft((prev) => prev.filter((_, i) => i !== index));
    setLinksDirty(true);
  }

  async function handleSaveLinks() {
    // Same rule the server enforces — checked here too so the user sees the
    // problem before a request round-trip, not after.
    const cleanedProjects = [];
    for (const row of projectLinksDraft) {
      const title = row.title.trim();
      const url = row.url.trim();
      if (!title && !url) continue; // a blank row left over from "Add link" — drop silently
      if (!title || !url) {
        toast.error('Each project link needs both a title and a URL.');
        return;
      }
      if (!/^https?:\/\/\S+$/i.test(url)) {
        toast.error(`"${url}" needs to start with http:// or https://`);
        return;
      }
      cleanedProjects.push({ title, url });
    }

    setLinksBusy(true);
    try {
      const { data } = await api.patch('/resumes/me/links', {
        links: linksDraft,
        projectLinks: cleanedProjects,
      });
      setResume(data.resume);
      setProjectLinksDraft(cleanedProjects);
      setLinksDirty(false);
      toast.success('Links saved.');
    } catch (err) {
      toast.error(err.message || 'Could not save links.');
    } finally {
      setLinksBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete('/resumes/me');
      setResume(null);
      toast.success('Resume, embeddings and stored file deleted.');
    } catch (err) {
      toast.error(err.message || 'Could not delete the resume.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {returnTo ? (
        <Link
          to={returnTo}
          className="inline-flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {'<- Back to your campaign draft'}
        </Link>
      ) : null}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">My Resume</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 md:text-base">
          One resume powers everything: email personalisation, interview questions, your learning
          roadmap and resume Q&amp;A. Upload a new one any time — it replaces the old one and its
          search index automatically.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-app-muted">Loading…</p>
      ) : resume ? (
        <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-app">{resume.title}</h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Active
                </span>
              </div>
              <p className="mt-1 text-xs text-app-muted">
                {resume.wordCount.toLocaleString()} words · {resume.embedding.chunkCount} search
                chunk{resume.embedding.chunkCount === 1 ? '' : 's'} ·{' '}
                {resume.source === 'paste' ? 'pasted text' : resume.source} ·{' '}
                {resume.hasFile ? 'file stored for attachments' : 'no file attached'}
              </p>
              <p className="mt-1 text-xs text-app-muted">
                Search mode:{' '}
                <span className="font-semibold text-app">
                  {resume.embedding.provider
                    ? `semantic (${resume.embedding.provider})`
                    : 'keyword matching'}
                </span>
                {!resume.embedding.provider && (
                  <span className="text-app-muted">
                    {' '}
                    — add a valid GOOGLE_API_KEY to enable semantic search
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-400"
            >
              Delete resume
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-border pt-4">
            <Link
              to="/app/resume-chat"
              className="rounded-xl bg-app-muted px-3 py-2 text-xs font-semibold text-app transition hover:opacity-80"
            >
              Ask questions about it
            </Link>
            <Link
              to="/app/interview-prep"
              className="rounded-xl bg-app-muted px-3 py-2 text-xs font-semibold text-app transition hover:opacity-80"
            >
              Generate interview prep
            </Link>
            <Link
              to="/app/roadmap"
              className="rounded-xl bg-app-muted px-3 py-2 text-xs font-semibold text-app transition hover:opacity-80"
            >
              Build a learning roadmap
            </Link>
          </div>
        </div>
      ) : null}

      {resume && (
        <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
          <h2 className="text-base font-semibold text-app">Profile &amp; project links</h2>
          <p className="mt-1 text-xs text-app-muted">
            Saved once here, then reused everywhere you write outreach — insert them into a
            template or campaign as a one-click signature and a live-linked Projects section,
            instead of retyping URLs into every email.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LINK_FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`link-${f.key}`} className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                  {f.label}
                </label>
                <input
                  id={`link-${f.key}`}
                  type="url"
                  value={linksDraft[f.key]}
                  onChange={(e) => updateLink(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-surface-border pt-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                Project links
              </label>
              <button
                type="button"
                onClick={addProjectLink}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Add project link
              </button>
            </div>

            {projectLinksDraft.length === 0 ? (
              <p className="mt-2 text-xs italic text-app-muted">
                No project links yet — add a live demo URL to feature it in outreach emails.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {projectLinksDraft.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateProjectLink(i, 'title', e.target.value)}
                      placeholder="Project name"
                      className="min-w-0 flex-1 rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                    />
                    <input
                      type="url"
                      value={row.url}
                      onChange={(e) => updateProjectLink(i, 'url', e.target.value)}
                      placeholder="https://your-live-demo.com"
                      className="min-w-0 flex-[2] rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeProjectLink(i)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveLinks}
            disabled={!linksDirty || linksBusy}
            className="mt-5 rounded-xl bg-app-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
          >
            {linksBusy ? 'Saving…' : 'Save links'}
          </button>
        </div>
      )}

      {!resume && (
        <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-6 text-center">
          <p className="text-sm font-semibold text-app">No resume yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-app-muted">
            Add one below to unlock personalised emails, interview prep and roadmaps.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
        <div className="mb-4 flex gap-1 rounded-xl bg-default-bg p-1">
          {['upload', 'paste'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                mode === m ? 'bg-app-surface text-app shadow-soft' : 'text-app-muted'
              }`}
            >
              {m === 'upload' ? 'Upload a file' : 'Paste text'}
            </button>
          ))}
        </div>

        {mode === 'upload' ? (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-border p-8 text-center transition hover:border-primary ${
              busy ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <span className="text-sm font-semibold text-app">
              {busy ? 'Extracting and saving…' : 'Click to choose a PDF, Word or text file'}
            </span>
            <span className="mt-1 text-[11px] text-app-muted">
              Max 2MB · replaces your current resume
            </span>
            <input
              type="file"
              accept={ACCEPTED_RESUME_TYPES}
              className="hidden"
              disabled={busy}
              onChange={handleFile}
            />
          </label>
        ) : (
          <form onSubmit={handlePaste} className="space-y-3">
            <div>
              <label htmlFor="rtitle" className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                Title
              </label>
              <input
                id="rtitle"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
              />
            </div>
            <div>
              <label htmlFor="rtext" className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                Resume text
              </label>
              <textarea
                id="rtext"
                rows={12}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your full resume here…"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-app-gradient py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Saving…' : resume ? 'Replace my resume' : 'Save my resume'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
