import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import ProviderBadge from '../components/ui/ProviderBadge';
import { useAuth } from '../context/AuthContext';

const WORK_MODES = ['Remote', 'Hybrid', 'On-site'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const EXPERIENCE_LEVELS = ['Fresher', 'Junior', 'Mid', 'Senior', 'Lead'];

const EMPTY_FORM = {
  title: '',
  company: '',
  location: '',
  workMode: 'Hybrid',
  employmentType: 'Full-time',
  experienceLevel: 'Mid',
  salaryRange: '',
  skills: '',
  applyUrl: '',
  recruiterName: '',
  recruiterLinkedIn: '',
  description: '',
};

export default function PostJob() {
  const navigate = useNavigate();
  const { isRecruiter } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractProvider, setExtractProvider] = useState(null);

  function set(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleExtract() {
    if (!rawText.trim()) {
      toast.info('Paste a job description first.');
      return;
    }
    setExtracting(true);
    try {
      const { data } = await api.post('/jobs/extract', { rawText });
      const f = data.fields || {};
      setFormData((prev) => ({
        ...prev,
        title: f.title || prev.title,
        company: f.company || prev.company,
        location: f.location || prev.location,
        workMode: WORK_MODES.includes(f.workMode) ? f.workMode : prev.workMode,
        employmentType: EMPLOYMENT_TYPES.includes(f.employmentType) ? f.employmentType : prev.employmentType,
        experienceLevel: EXPERIENCE_LEVELS.includes(f.experienceLevel) ? f.experienceLevel : prev.experienceLevel,
        salaryRange: f.salaryRange || prev.salaryRange,
        skills: Array.isArray(f.skills) ? f.skills.join(', ') : prev.skills,
        description: f.description || prev.description,
      }));
      setExtractProvider(data.provider);
      toast.success('Fields extracted — review and adjust below before publishing.');
    } catch (err) {
      toast.error(err.message || 'Could not extract fields from that text.');
    } finally {
      setExtracting(false);
    }
  }

  if (!isRecruiter) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-10 text-center">
          <h1 className="text-lg font-semibold text-app">Recruiter account required</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-app-muted">
            Posting jobs is a Recruiter feature. Switch your account type in Settings to unlock it.
          </p>
          <Link
            to="/app/settings"
            className="mt-4 inline-block rounded-xl bg-app-gradient px-4 py-2 text-sm font-semibold text-white"
          >
            Switch to Recruiter
          </Link>
        </div>
      </div>
    );
  }

  async function handlePostJob(e) {
    e.preventDefault();
    if (!formData.title.trim() || !formData.company.trim() || !formData.location.trim() || !formData.description.trim()) {
      toast.info('Please fill out all required fields marked with *');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/jobs', {
        ...formData,
        title: formData.title.trim(),
        company: formData.company.trim(),
        location: formData.location.trim(),
        description: formData.description.trim(),
        applyUrl: formData.applyUrl.trim(),
        recruiterName: formData.recruiterName.trim(),
        recruiterLinkedIn: formData.recruiterLinkedIn.trim(),
      });
      toast.success(`Published "${formData.title}" to the job board.`);
      navigate('/app/jobs');
    } catch (err) {
      toast.error(err.message || 'Could not publish this job.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Post a Job</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-purple-100 md:text-base">
            Fill out the role details to publish it directly to the job board.
          </p>
        </div>
        <button
          onClick={() => navigate('/app/jobs')}
          className="whitespace-nowrap rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold shadow-md transition hover:bg-white/20"
        >
          Back to Job Board
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-surface-border bg-app-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-app">
            Paste a job description (optional)
          </h2>
          <ProviderBadge provider={extractProvider} />
        </div>
        <p className="text-xs text-app-muted">
          Paste the raw JD text from anywhere and AI will fill in the fields below for you to
          review — nothing publishes until you submit the form yourself.
        </p>
        <textarea
          rows={5}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste the full job description text here…"
          className="block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={extracting}
          className="rounded-xl bg-app-gradient px-4 py-2 text-xs font-semibold text-white shadow-soft transition hover:opacity-90 disabled:opacity-50"
        >
          {extracting ? 'Extracting…' : 'Extract fields with AI'}
        </button>
      </div>

      <div className="space-y-6 rounded-2xl border border-surface-border bg-app-surface p-6 shadow-sm">
        <form onSubmit={handlePostJob} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Job Title *</label>
              <input
                type="text" required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Senior Frontend Engineer"
                value={formData.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Company Name *</label>
              <input
                type="text" required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Razorpay"
                value={formData.company}
                onChange={(e) => set('company', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Location *</label>
              <input
                type="text" required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Bengaluru, India"
                value={formData.location}
                onChange={(e) => set('location', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Work Mode</label>
              <select
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                value={formData.workMode}
                onChange={(e) => set('workMode', e.target.value)}
              >
                {WORK_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Employment Type</label>
              <select
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                value={formData.employmentType}
                onChange={(e) => set('employmentType', e.target.value)}
              >
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Experience Level</label>
              <select
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                value={formData.experienceLevel}
                onChange={(e) => set('experienceLevel', e.target.value)}
              >
                {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Salary Range</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. ₹18-24 LPA"
                value={formData.salaryRange}
                onChange={(e) => set('salaryRange', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Skills (comma-separated)</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. React, Node.js, AWS"
                value={formData.skills}
                onChange={(e) => set('skills', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Recruiter Name</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Pooja Nair"
                value={formData.recruiterName}
                onChange={(e) => set('recruiterName', e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Recruiter LinkedIn</label>
              <input
                type="url"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="https://linkedin.com/in/..."
                value={formData.recruiterLinkedIn}
                onChange={(e) => set('recruiterLinkedIn', e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Direct Apply Link</label>
              <input
                type="url"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="https://careers.example.com/jobs/123"
                value={formData.applyUrl}
                onChange={(e) => set('applyUrl', e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Role Description *</label>
              <textarea
                rows={4} required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="Responsibilities, requirements, what a strong candidate looks like..."
                value={formData.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/app/jobs')}
              className="rounded-xl border border-surface-border bg-default-bg px-5 py-2 text-xs font-semibold text-app-muted hover:text-app"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Publishing…' : 'Publish Job Opening'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
