import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function PostJob() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: 'Mumbai, India',
    type: 'Hybrid',
    experience: 'Mid-Level',
    salary: '₹15,00,000 - ₹25,00,000',
    skills: '',
    applyUrl: '',
    recruiterName: '',
    recruiterLinkedIn: '',
    description: '',
    industry: 'IT & Software Services',
    companySize: '50-500'
  });

  const handlePostJob = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.company || !formData.salary || !formData.description) {
      toast.info('Please fill out all required fields marked with *');
      return;
    }

    const uniqueId = `JOB-${Math.floor(1000 + Math.random() * 9000)}`;
    const newJob = {
      id: uniqueId,
      title: formData.title.trim(),
      company: formData.company.trim(),
      location: formData.location.trim(),
      type: formData.type,
      experience: formData.experience,
      salary: formData.salary.trim(),
      skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : ['JavaScript'],
      applyUrl: formData.applyUrl.trim() || 'https://mailpilot.app',
      recruiterName: formData.recruiterName.trim() || 'Recruiting Team',
      recruiterLinkedIn: formData.recruiterLinkedIn.trim() || 'https://linkedin.com',
      description: formData.description.trim(),
      industry: formData.industry,
      companySize: formData.companySize,
      datePosted: new Date().toLocaleDateString()
    };

    // Save to localStorage
    const savedJobsString = localStorage.getItem('mailpilot_custom_jobs');
    let customJobs = [];
    if (savedJobsString) {
      try {
        customJobs = JSON.parse(savedJobsString);
      } catch (err) {
        customJobs = [];
      }
    }

    customJobs = [newJob, ...customJobs];
    localStorage.setItem('mailpilot_custom_jobs', JSON.stringify(customJobs));
    toast.success(`Published job listing "${newJob.title}" successfully!`);
    
    // Navigate back to the Job Search page
    navigate('/app/job-search');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-700 via-purple-600 to-indigo-700 p-6 text-white shadow-lg md:p-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Recruiter Job Portal</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-purple-100 md:text-base">
            Create professional job postings. Fill out the position parameters to publish target openings directly to the candidate search board.
          </p>
        </div>
        <button
          onClick={() => navigate('/app/job-search')}
          className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-bold px-4 py-2 text-xs shadow-md transition whitespace-nowrap"
        >
          Back to Careers Board
        </button>
      </div>

      {/* Recruiter / Organization Posting Form */}
      <div className="rounded-2xl border border-surface-border bg-app-surface p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-app">Post Job Opening</h2>
          <p className="text-xs text-app-muted mt-1">Provide position details, compensation parameters, and contact coordinates.</p>
        </div>
        
        <form onSubmit={handlePostJob} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Job Title *</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Senior Frontend Architect"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Company Name *</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Razorpay"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Location *</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Mumbai, India or Noida, India"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Work Place Type</label>
              <select
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary dark:bg-slate-900"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Experience Level</label>
              <select
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary dark:bg-slate-900"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              >
                <option value="Entry-Level">Entry-Level (0-2 years)</option>
                <option value="Mid-Level">Mid-Level (2-5 years)</option>
                <option value="Senior/Lead">Senior / Lead (5+ years)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Salary Compensation *</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. ₹18,00,000 - ₹24,00,000"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Technical Stack / Skills (comma-separated)</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. React.js, Node.js, AWS"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Industry Type</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Fintech, E-commerce, EdTech"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Company Size (Employees)</label>
              <select
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary dark:bg-slate-900"
                value={formData.companySize}
                onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
              >
                <option value="1-50">1-50 (Early Stage)</option>
                <option value="50-500">50-500 (Mid market / Growth)</option>
                <option value="500+">500+ (Enterprise)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Recruiter Full Name</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. Pooja Nair"
                value={formData.recruiterName}
                onChange={(e) => setFormData({ ...formData, recruiterName: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Recruiter LinkedIn Link</label>
              <input
                type="url"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. https://linkedin.com/in/pooja-recruiter"
                value={formData.recruiterLinkedIn}
                onChange={(e) => setFormData({ ...formData, recruiterLinkedIn: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Direct Apply Link</label>
              <input
                type="url"
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="e.g. https://careers.razorpay.com/jobs/designer"
                value={formData.applyUrl}
                onChange={(e) => setFormData({ ...formData, applyUrl: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Role Description *</label>
              <textarea
                rows={4}
                required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-sm text-app outline-none focus:border-primary"
                placeholder="Brief summary of required duties, capabilities and expectations..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/app/job-search')}
              className="rounded-xl border border-surface-border bg-default-bg px-5 py-2 text-xs font-semibold text-app-muted hover:text-app"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:opacity-90"
            >
              Publish Job Opening
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
