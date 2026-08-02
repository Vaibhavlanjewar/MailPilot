import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import ProviderBadge from '../components/ui/ProviderBadge';

const PRIORITY_STYLE = {
  high: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

export default function CareerFit() {
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasResume, setHasResume] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/career/fit').then(({ data }) => setAdvice(data.advice)),
      api.get('/resumes/me').then(({ data }) => setHasResume(Boolean(data.resume))),
    ])
      .catch((err) => toast.error(err.message || 'Could not load.'))
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const { data } = await api.post('/career/fit');
      setAdvice(data.advice);
      toast.success('Suggestions updated from your latest resume.');
    } catch (err) {
      toast.error(err.message || 'Could not generate suggestions.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-blue-600 to-cyan-600 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Career Fit</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 md:text-base">
          Where should you actually be looking? AI reads your resume and suggests company types,
          locations, a realistic salary band, and the skill gaps most worth closing — all tied to
          specific evidence in your resume, not generic advice.
        </p>
      </div>

      {!hasResume && (
        <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-6 text-center">
          <p className="text-sm font-semibold text-app">Add your resume first</p>
          <p className="mt-1 text-xs text-app-muted">These suggestions need real evidence to work from.</p>
          <Link to="/app/resume" className="mt-3 inline-block rounded-xl bg-app-gradient px-4 py-2 text-xs font-semibold text-white">
            Add resume
          </Link>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-app-muted">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-app">
                {advice ? 'Latest suggestions' : 'No suggestions yet'}
              </p>
              {advice?.updatedAt && (
                <p className="text-xs text-app-muted">
                  Generated {new Date(advice.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ProviderBadge provider={advice?.provider} />
              <button
                onClick={generate}
                disabled={generating || !hasResume}
                className="rounded-xl bg-app-gradient px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
              >
                {generating ? 'Analyzing…' : advice ? 'Regenerate' : 'Generate suggestions'}
              </button>
            </div>
          </div>

          {advice && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Your position</h2>
                  <p className="mt-2 text-sm leading-relaxed text-app">{advice.summary}</p>
                  {advice.strengths?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {advice.strengths.map((s) => (
                        <span key={s} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Company types to target</h2>
                <div className="mt-3 space-y-3">
                  {advice.companyTypes?.map((c) => (
                    <div key={c.type} className="rounded-xl border border-surface-border bg-default-bg p-3">
                      <p className="text-sm font-semibold text-app">{c.type}</p>
                      <p className="mt-1 text-xs text-app-muted">{c.why}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Locations</h2>
                <div className="mt-3 space-y-3">
                  {advice.locations?.map((l) => (
                    <div key={l.location} className="rounded-xl border border-surface-border bg-default-bg p-3">
                      <p className="text-sm font-semibold text-app">{l.location}</p>
                      <p className="mt-1 text-xs text-app-muted">{l.why}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Target roles</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {advice.targetRoles?.map((r) => (
                    <span key={r} className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Realistic salary band</h2>
                {advice.salaryBand?.min ? (
                  <>
                    <p className="mt-2 text-lg font-bold text-app">
                      {advice.salaryBand.currency} {Number(advice.salaryBand.min).toLocaleString()} – {Number(advice.salaryBand.max).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-app-muted">{advice.salaryBand.note}</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-app-muted">Not enough evidence in your resume to estimate this.</p>
                )}
              </div>

              <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm lg:col-span-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Skill gaps worth closing</h2>
                <div className="mt-3 space-y-2">
                  {advice.skillGaps?.map((g) => (
                    <div key={g.skill} className="flex items-start justify-between gap-3 rounded-xl border border-surface-border bg-default-bg p-3">
                      <div>
                        <p className="text-sm font-semibold text-app">{g.skill}</p>
                        <p className="mt-0.5 text-xs text-app-muted">{g.why}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_STYLE[g.priority] || PRIORITY_STYLE.medium}`}>
                        {g.priority}
                      </span>
                    </div>
                  ))}
                </div>
                <Link to="/app/roadmap" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
                  Build a learning roadmap for these →
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
