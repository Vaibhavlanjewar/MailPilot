import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

const EXPERIENCE_LEVELS = ['Fresher', 'Junior', 'Mid', 'Senior', 'Lead'];
const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

const EMPTY_FILTERS = {
  q: '',
  location: '',
  workMode: '',
  experienceLevel: '',
  employmentType: '',
  company: '',
  skill: '',
  salaryMin: '',
  datePosted: '',
};

export default function JobSearch() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filterOptions, setFilterOptions] = useState({
    locations: [], skills: [], companies: [], datePostedOptions: [],
  });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [savingId, setSavingId] = useState(null);
  // Guards against out-of-order responses (StrictMode double-invoke, debounce +
  // network jitter) overwriting fresh state with a stale/failed older request.
  const requestIdRef = useRef(0);

  useEffect(() => {
    api.get('/jobs/filters').then(({ data }) => {
      setFilterOptions({
        locations: data.locations || [],
        skills: data.skills || [],
        companies: data.companies || [],
        datePostedOptions: data.datePostedOptions || [],
      });
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const params = { page, ...filters };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const { data } = await api.get('/jobs', { params });
      if (requestId !== requestIdRef.current) return; // a newer request has since started
      setJobs(data.jobs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      toast.error(err.message || 'Could not load jobs.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // debounce keyword/salary typing
    return () => clearTimeout(timer);
  }, [load]);

  function setFilter(key, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? '' : value }));
  }

  function resetFilters() {
    setPage(1);
    setFilters(EMPTY_FILTERS);
    toast.info('Filters cleared.');
  }

  async function toggleSave(job) {
    setSavingId(job._id);
    setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, isSaved: !j.isSaved } : j)));
    try {
      await api.post(`/jobs/${job._id}/save`);
    } catch (err) {
      toast.error(err.message || 'Could not update saved jobs.');
      setJobs((prev) => prev.map((j) => (j._id === job._id ? { ...j, isSaved: job.isSaved } : j)));
    } finally {
      setSavingId(null);
    }
  }

  const chipBtn = (active) =>
    `rounded-xl px-3 py-2 text-xs font-semibold text-center border transition ${
      active
        ? 'bg-primary border-primary text-white shadow-soft font-bold'
        : 'bg-default-bg border-surface-border text-app-muted hover:text-app'
    }`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-r from-teal-700 via-emerald-600 to-indigo-700 p-6 text-white shadow-lg md:flex-row md:items-center md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Job Board</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-teal-100 md:text-base">
            {total} live listing{total === 1 ? '' : 's'} across top tech companies. Search, filter,
            save the ones you like, and generate a personalised outreach template from Templates.
          </p>
        </div>
        <button
          onClick={() => navigate('/app/post-job')}
          className="shrink-0 whitespace-nowrap rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-teal-800 shadow-md transition hover:bg-neutral-100"
        >
          Post a Job
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 self-start rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-app">Filters</h2>
            <button onClick={resetFilters} className="text-xs font-semibold text-primary hover:underline">
              Reset
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">Keyword</label>
            <div className="relative">
              <svg className="absolute left-3 top-3 h-4 w-4 text-app-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" />
              </svg>
              <input
                type="text"
                className="block w-full rounded-xl border border-input-border bg-transparent py-2.5 pl-9 pr-3 text-sm text-app outline-none focus:border-primary"
                placeholder="Title, company, description..."
                value={filters.q}
                onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, q: e.target.value })); }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">Location</label>
            <select
              value={filters.location}
              onChange={(e) => setFilter('location', e.target.value)}
              className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
            >
              <option value="">Any location</option>
              {filterOptions.locations.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">Company</label>
            <select
              value={filters.company}
              onChange={(e) => setFilter('company', e.target.value)}
              className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
            >
              <option value="">Any company</option>
              {filterOptions.companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Experience level</label>
            <div className="grid grid-cols-2 gap-2">
              {EXPERIENCE_LEVELS.map((exp) => (
                <button key={exp} onClick={() => setFilter('experienceLevel', exp)} className={chipBtn(filters.experienceLevel === exp)}>
                  {exp}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Work mode</label>
            <div className="grid grid-cols-3 gap-2">
              {WORK_MODES.map((m) => (
                <button key={m} onClick={() => setFilter('workMode', m)} className={chipBtn(filters.workMode === m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Employment type</label>
            <div className="grid grid-cols-2 gap-2">
              {EMPLOYMENT_TYPES.map((t) => (
                <button key={t} onClick={() => setFilter('employmentType', t)} className={chipBtn(filters.employmentType === t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Skills</label>
            <div className="flex flex-wrap gap-1.5">
              {filterOptions.skills.slice(0, 16).map((skill) => (
                <button
                  key={skill}
                  onClick={() => setFilter('skill', skill)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                    filters.skill === skill
                      ? 'border-primary bg-primary/10 font-bold text-primary'
                      : 'border-surface-border bg-default-bg text-app-muted hover:text-app'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">Min salary (LPA floor)</label>
            <input
              type="number"
              min="0"
              className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
              placeholder="e.g. 20"
              value={filters.salaryMin}
              onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, salaryMin: e.target.value })); }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">Date posted</label>
            <select
              value={filters.datePosted}
              onChange={(e) => setFilter('datePosted', e.target.value)}
              className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
            >
              {filterOptions.datePostedOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-surface-border pb-2 text-xs font-semibold text-app-muted">
            <span>{loading ? 'Loading…' : `${total} matching role${total === 1 ? '' : 's'}`}</span>
            <span>Page {page} of {totalPages}</span>
          </div>

          {!loading && jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-12 text-center text-app-muted">
              <h3 className="text-sm font-semibold text-app">No jobs match these filters</h3>
              <p className="mt-1 text-xs">Try widening your search or clearing a filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {jobs.map((job) => (
                <div key={job._id} className="flex flex-col justify-between rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm transition hover:shadow-md">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded border border-teal-500/10 bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase leading-none text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
                          {job.workMode}
                        </span>
                        <span className="rounded border border-purple-500/10 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase leading-none text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
                          {job.experienceLevel}
                        </span>
                        {job.employmentType !== 'Full-time' && (
                          <span className="rounded border border-amber-500/10 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase leading-none text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                            {job.employmentType}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleSave(job)}
                        disabled={savingId === job._id}
                        title={job.isSaved ? 'Unsave' : 'Save'}
                        className={`shrink-0 transition ${job.isSaved ? 'text-rose-500' : 'text-app-muted hover:text-rose-500'}`}
                      >
                        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                          {job.isSaved ? (
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          ) : (
                            <path fill="none" stroke="currentColor" strokeWidth={1.5} d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          )}
                        </svg>
                      </button>
                    </div>

                    <h3 className="mt-3 text-base font-bold leading-snug text-app">{job.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{job.company}</p>

                    <div className="mt-2 flex items-center gap-1.5 text-xs text-app-muted">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span>{job.location}</span>
                    </div>

                    {job.salaryRange && (
                      <p className="mt-2 text-xs font-semibold text-app-muted">
                        Compensation: <span className="text-app">{job.salaryRange}</span>
                      </p>
                    )}

                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-app-muted">{job.description}</p>

                    <div className="mt-4 flex flex-wrap gap-1">
                      {(job.skills || []).map((skill) => (
                        <span key={skill} className="rounded-md border border-surface-border bg-default-bg px-2 py-0.5 text-[10px] font-medium text-app">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-surface-border pt-4">
                    {job.applyUrl && (
                      <a href={job.applyUrl} target="_blank" rel="noreferrer noopener" className="flex-1 rounded-xl bg-primary py-2 text-center text-xs font-semibold text-white shadow-soft transition hover:opacity-90">
                        Apply
                      </a>
                    )}
                    {job.recruiterLinkedIn && (
                      <a href={job.recruiterLinkedIn} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-default-bg px-3 py-2 text-xs font-semibold text-app-muted transition hover:text-primary">
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M22.23 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.23 0zM7.12 20.45H3.56V9h3.56v11.45zM5.34 7.43c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm15.11 13.02h-3.56v-5.6c0-1.34-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.7h-3.56V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29z" />
                        </svg>
                        Recruiter
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-xl border border-surface-border bg-app-surface px-4 py-2 text-xs font-semibold text-app-muted disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-app-muted">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-xl border border-surface-border bg-app-surface px-4 py-2 text-xs font-semibold text-app-muted disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
