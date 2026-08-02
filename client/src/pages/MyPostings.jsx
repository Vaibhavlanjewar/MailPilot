import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MyPostings() {
  const { isRecruiter } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/jobs/mine');
      setJobs(data.jobs || []);
    } catch (err) {
      toast.error(err.message || 'Could not load your postings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isRecruiter) load();
  }, [isRecruiter, load]);

  async function toggleActive(job) {
    setTogglingId(job._id);
    try {
      const { data } = await api.patch(`/jobs/${job._id}`, { active: !job.active });
      setJobs((prev) => prev.map((j) => (j._id === job._id ? data.job : j)));
    } catch (err) {
      toast.error(err.message || 'Could not update this listing.');
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteJob(job) {
    try {
      await api.delete(`/jobs/${job._id}`);
      setJobs((prev) => prev.filter((j) => j._id !== job._id));
      toast.success('Listing deleted.');
    } catch (err) {
      toast.error(err.message || 'Could not delete this listing.');
    }
  }

  if (!isRecruiter) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-10 text-center">
          <h1 className="text-lg font-semibold text-app">Recruiter account required</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-app-muted">
            Managing postings is a Recruiter feature. Switch your account type in Settings.
          </p>
          <Link to="/app/settings" className="mt-4 inline-block rounded-xl bg-app-gradient px-4 py-2 text-sm font-semibold text-white">
            Switch to Recruiter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">My Postings</h1>
          <p className="mt-2 text-sm text-purple-100 md:text-base">
            {jobs.length} listing{jobs.length === 1 ? '' : 's'} posted by you.
          </p>
        </div>
        <Link
          to="/app/post-job"
          className="whitespace-nowrap rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-purple-800 shadow-md transition hover:bg-neutral-100"
        >
          Post a new job
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-app-muted">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-12 text-center text-app-muted">
          <h3 className="text-sm font-semibold text-app">No postings yet</h3>
          <p className="mt-1 text-xs">Post your first job opening to see it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-surface-border bg-app-surface p-4 shadow-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-app">{job.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    job.active
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-500/10 text-slate-500'
                  }`}>
                    {job.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-app-muted">
                  {job.company} · {job.location} · {job.workMode} · Posted{' '}
                  {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => toggleActive(job)}
                  disabled={togglingId === job._id}
                  className="rounded-xl bg-app-muted px-3 py-2 text-xs font-semibold text-app transition hover:opacity-80 disabled:opacity-50"
                >
                  {job.active ? 'Pause' : 'Reactivate'}
                </button>
                <button
                  onClick={() => deleteJob(job)}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
