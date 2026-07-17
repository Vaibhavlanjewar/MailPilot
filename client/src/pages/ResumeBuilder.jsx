import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function ResumeBuilder() {
  const navigate = useNavigate();
  const [resumesList, setResumesList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [savingCloud, setSavingCloud] = useState(false);
  const [optimizingAi, setOptimizingAi] = useState(false);

  // Resume builder state fields
  const [resumeId, setResumeId] = useState('');
  const [resumeTitle, setResumeTitle] = useState('My Core Software Engineer Profile');
  const [roleTitle, setRoleTitle] = useState('Senior Fullstack Engineer');
  const [summary, setSummary] = useState('Highly technical developer specializing in scaleable React components, distributed backend APIs, and in-memory caches.');
  const [skillsText, setSkillsText] = useState('React, Node.js, Express, MongoDB, Firebase, Redis, Go, AWS, Docker');
  const [linkedin, setLinkedin] = useState('https://linkedin.com/in/vaibhavcandidate');
  const [github, setGithub] = useState('https://github.com/vaibhavdev');
  const [portfolio, setPortfolio] = useState('https://vaibhavdev.io');
  const [leetcode, setLeetcode] = useState('https://leetcode.com/vaibhav');

  // Multi-item experience arrays
  const [experienceText, setExperienceText] = useState(
    "Lead Developer at fintech startup. Built transaction ledger systems and integrated real-time microservices.\nSoftware Intern at meta. Enhanced user interface analytics widgets."
  );

  // Multi-item projects arrays
  const [projectsText, setProjectsText] = useState(
    "MailPilot: Cold outreach scheduling software utilizing BullMQ queue workers and local AI fallbacks.\nResumeParser: Distributed indexing pipeline parsing 500+ daily resumes with PDF.js OCR."
  );

  // Template design choice
  const [selectedTemplate, setSelectedTemplate] = useState('Modern Tech');

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    setLoadingList(true);
    try {
      const resp = await api.get('/resumes');
      if (resp.data && resp.data.resumes) {
        setResumesList(resp.data.resumes);
      }
    } catch (err) {
      console.warn("Failed fetching resumes list:", err);
    } finally {
      setLoadingList(false);
    }
  };

  // Document uploader helper scripts
  const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) return resolve(window.pdfjsLib);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const loadMammoth = () => {
    return new Promise((resolve, reject) => {
      if (window.mammoth) return resolve(window.mammoth);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.onload = () => resolve(window.mammoth);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const parsePdf = async (arrayBuffer) => {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const parseDocx = async (arrayBuffer) => {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Enforce 2MB size limit
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Blocked: File exceeds the maximum 2MB size limit allowed for resume cloud storage.');
      return;
    }

    const lowerName = file.name.toLowerCase();
    const reader = new FileReader();

    toast.info('Reading and extracting file contents...');

    reader.onload = async (event) => {
      try {
        let extractedText = '';
        if (lowerName.endsWith('.pdf')) {
          extractedText = await parsePdf(event.target.result);
        } else if (lowerName.endsWith('.docx')) {
          extractedText = await parseDocx(event.target.result);
        } else {
          // treat as plain text
          const textDecoder = new TextDecoder('utf-8');
          extractedText = textDecoder.decode(event.target.result);
        }

        if (!extractedText.trim()) {
          toast.warning('Extraction completed but retrieved empty content.');
          return;
        }

        // Convert base64 representation of file
        const base64String = btoa(
          new Uint8Array(event.target.result)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // Upload parsed content to backend (/api/resumes/upload)
        const payload = {
          title: file.name,
          type: 'document',
          content: extractedText.trim(),
          links: { linkedin, github, portfolio, leetcode },
          fileName: file.name,
          fileSize: file.size,
          fileBase64: base64String
        };

        const uploadResp = await api.post('/resumes/upload', payload);
        if (uploadResp.data && uploadResp.data.success) {
          toast.success(
            uploadResp.data.deletedOldest
              ? 'Successfully uploaded! Replaced oldest stored CV to remain within cloud storage limit (max 2).'
              : 'Successfully uploaded and parsed resume to Firebase Cloud Storage.'
          );
          fetchResumes();
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse or upload document payload to Firebase service.');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleOptimizeAi = async () => {
    if (!roleTitle || !skillsText) {
      toast.info('Please enter target role title and skills context to optimize builder content.');
      return;
    }

    setOptimizingAi(true);
    try {
      const resp = await api.post('/resumes/optimize', {
        roleTitle,
        skillsList: skillsText,
        existingExperience: experienceText
      });

      if (resp.data && resp.data.data) {
        const { summary: aiSum, experienceBullets, projectBullets } = resp.data.data;
        if (aiSum) setSummary(aiSum);
        if (experienceBullets) {
          setExperienceText(experienceBullets.join('\n'));
        }
        if (projectBullets) {
          setProjectsText(projectBullets.join('\n'));
        }
        toast.success('AI Optimized content parsed and synchronized with live builder fields.');
      }
    } catch (e) {
      toast.error('Error contacting active AI model for resume builder feedback.');
    } finally {
      setOptimizingAi(false);
    }
  };

  const handleSaveBuiltResume = async () => {
    setSavingCloud(true);
    try {
      const payload = {
        id: resumeId || undefined,
        title: resumeTitle,
        templates: selectedTemplate,
        links: { linkedin, github, portfolio, leetcode },
        content: JSON.stringify({
          roleTitle,
          summary,
          skillsText,
          experienceText,
          projectsText
        })
      };

      const resp = await api.post('/resumes/save-built', payload);
      if (resp.data && resp.data.success) {
        setResumeId(resp.data.resume.id);
        toast.success('Saved built resume and custom links data directly into Firebase Firestore.');
        fetchResumes();
      }
    } catch (e) {
      toast.error('Failed updating structured resume model.');
    } finally {
      setSavingCloud(false);
    }
  };

  const handleDeleteResume = async (id) => {
    try {
      const resp = await api.delete(`/resumes/${id}`);
      if (resp.data && resp.data.success) {
        toast.success('Successfully removed entry from resume storage index.');
        if (resumeId === id) setResumeId('');
        fetchResumes();
      }
    } catch (err) {
      toast.error('Error removing document storage node.');
    }
  };

  const handleLoadBuiltResumeObj = (resObj) => {
    if (resObj.type !== 'built') {
      // document upload
      setSummary(resObj.content);
      setResumeTitle(resObj.title);
      setResumeId(resObj.id);
      toast.info('Loaded raw parsed text content into profile summary field.');
      return;
    }

    try {
      const parsed = JSON.parse(resObj.content);
      setResumeId(resObj.id);
      setResumeTitle(resObj.title);
      setSelectedTemplate(resObj.templates || 'Modern Tech');
      if (parsed.roleTitle) setRoleTitle(parsed.roleTitle);
      if (parsed.summary) setSummary(parsed.summary);
      if (parsed.skillsText) setSkillsText(parsed.skillsText);
      if (parsed.experienceText) setExperienceText(parsed.experienceText);
      if (parsed.projectsText) setProjectsText(parsed.projectsText);
      
      if (resObj.links) {
        setLinkedin(resObj.links.linkedin || '');
        setGithub(resObj.links.github || '');
        setPortfolio(resObj.links.portfolio || '');
        setLeetcode(resObj.links.leetcode || '');
      }
      toast.success('Loaded saved resume template from cloud database.');
    } catch (e) {
      toast.error('Could not construct fields array.');
    }
  };

  // Convert block string lines to array
  const getExperienceLines = () => experienceText.split('\n').filter(Boolean);
  const getProjectLines = () => projectsText.split('\n').filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header Panel */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Overleaf-Style Resume Builder & Cloud Storage</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-105 md:text-base">
          Build structured candidate files, link coding/social targets, and optimize layout bullets with local Gemini/Ollama backups. Uploads are securely synced to Firebase Cloud Storage.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left pane: File listing, upload size limit check and form builder inputs */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* File Cloud Manager */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-surface-border pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-app">Cloud Resume Manager</h2>
              <span className="text-[10px] text-primary uppercase font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                Limit: 2 Files Max
              </span>
            </div>

            {/* Cloud Files Listing */}
            {loadingList ? (
              <p className="text-xs text-app-muted">Querying Firebase Firestore Index...</p>
            ) : resumesList.length === 0 ? (
              <p className="text-xs text-app-muted italic text-center py-2">No uploaded or built resumes found matching account node.</p>
            ) : (
              <div className="space-y-2">
                {resumesList.map((res) => (
                  <div key={res.id} className="flex justify-between items-center p-2.5 rounded-xl bg-default-bg border border-surface-border text-xs gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-app truncate">{res.title}</p>
                      <p className="text-[10px] text-app-muted uppercase font-semibold">
                        Type: {res.type} | Size: {res.fileSize || res.content.length} Bytes
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadBuiltResumeObj(res)}
                        className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold hover:bg-primary/20 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => navigate('/app/resume-rag', { state: { resumeId: res.id } })}
                        className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-bold hover:bg-emerald-500/20 transition"
                      >
                        Chat (RAG)
                      </button>
                      <button
                        onClick={() => handleDeleteResume(res.id)}
                        className="p-1 rounded hover:bg-rose-100 text-rose-500 transition"
                        title="Delete cloud record"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload form block */}
            <div className="pt-2">
              <label className="border-2 border-dashed border-input-border rounded-2xl flex flex-col items-center justify-center py-5 cursor-pointer bg-default-bg/40 hover:bg-default-bg/85 transition text-center px-4">
                <svg className="mx-auto h-8 w-8 text-app-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <span className="mt-2 text-xs font-semibold text-app">Drag/Click to upload offline CV</span>
                <span className="text-[10px] text-app-muted mt-1 leading-snug">Max 2MB format limits (PDF, Docx, Txt)</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {/* Builder Form Inputs */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-app border-b border-surface-border pb-2">Builder Form Fields</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Template Profile Title</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                  value={resumeTitle}
                  onChange={(e) => setResumeTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-app-muted">Target Career Role</label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-app-muted">Visual Theme Template</label>
                  <select
                    className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary dark:bg-slate-900"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    <option value="Modern Tech">Modern Tech (Clean Accent)</option>
                    <option value="Minimalist Border">Minimalist Border</option>
                    <option value="Executive Premium">Executive Premium</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Skills Inventory (Comma-separated)</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Profile Bio / Summary</label>
                <textarea
                  rows={2}
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Professional Experience (One line per bullet/position)</label>
                <textarea
                  rows={3}
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                  value={experienceText}
                  onChange={(e) => setExperienceText(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Key Projects (One line per detail block)</label>
                <textarea
                  rows={3}
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                  value={projectsText}
                  onChange={(e) => setProjectsText(e.target.value)}
                />
              </div>

              {/* Social and portfolio link integrations */}
              <div className="bg-default-bg/50 border border-surface-border rounded-xl p-3 space-y-2">
                <span className="block text-[9px] font-bold uppercase text-app-muted tracking-wider">Social Channels & Portfolio Integrations</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="LinkedIn URL"
                    className="block w-full rounded-lg border border-input-border bg-transparent p-2 text-[10px] text-app outline-none focus:border-primary"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="GitHub URL"
                    className="block w-full rounded-lg border border-input-border bg-transparent p-2 text-[10px] text-app outline-none focus:border-primary"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Portfolio URL"
                    className="block w-full rounded-lg border border-input-border bg-transparent p-2 text-[10px] text-app outline-none focus:border-primary"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="LeetCode profile URL"
                    className="block w-full rounded-lg border border-input-border bg-transparent p-2 text-[10px] text-app outline-none focus:border-primary"
                    value={leetcode}
                    onChange={(e) => setLeetcode(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={optimizingAi}
                  onClick={handleOptimizeAi}
                  className="flex-1 rounded-xl border border-primary/20 bg-primary/5 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {optimizingAi ? 'Optimizing CV...' : '🚀 AI Content optimizer'}
                </button>
                <button
                  type="button"
                  disabled={savingCloud}
                  onClick={handleSaveBuiltResume}
                  className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-white shadow-soft transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {savingCloud ? 'Saving...' : '💾 Save & Sync Cloud'}
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Right pane: Overleaf-style premium preview template rendering sheets */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-app-muted border-b border-surface-border pb-2">
            <span>LIVE RESUME PREVIEW SHEET (OVERLEAF THEME STYLE)</span>
            <span>LAYOUT: {selectedTemplate.toUpperCase()}</span>
          </div>

          {/* Theme engine selector container sheet */}
          <div className="flex-1 bg-white p-6 md:p-8 rounded-2xl border border-slate-300 dark:border-slate-800 text-slate-900 shadow-lg min-h-[600px] flex flex-col justify-between font-sans">
            
            {/* Header styling depending on template */}
            <div className="space-y-4">
              
              {selectedTemplate === 'Modern Tech' ? (
                <div className="border-b-4 border-indigo-700 pb-3">
                  <h1 className="text-2xl font-bold tracking-tight text-indigo-900">{resumeTitle || 'CANDIDATE PROFILE'}</h1>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-750">{roleTitle || 'Role Title'}</h3>
                </div>
              ) : selectedTemplate === 'Minimalist Border' ? (
                <div className="border border-slate-350 p-4 rounded-xl text-center shadow-sm">
                  <h1 className="text-xl font-bold tracking-widest uppercase text-slate-800">{resumeTitle || 'CANDIDATE PROFILE'}</h1>
                  <hr className="w-1/4 mx-auto my-2 border-slate-400" />
                  <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase">{roleTitle || 'Role Title'}</h3>
                </div>
              ) : (
                <div className="bg-slate-900 p-6 rounded-xl text-white">
                  <h1 className="text-2xl font-semibold tracking-wide uppercase">{resumeTitle || 'CANDIDATE Profile'}</h1>
                  <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mt-1">{roleTitle || 'Role Title'}</h3>
                </div>
              )}

              {/* Social profile connections sub-bar */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-semibold text-slate-500 border-b border-slate-200 pb-3">
                {linkedin && (
                  <span className="flex items-center gap-1">
                    <span className="text-indigo-600 font-bold">LINKEDIN:</span>
                    <span className="truncate max-w-[120px]">{linkedin.replace('https://', '')}</span>
                  </span>
                )}
                {github && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-800 font-bold">GITHUB:</span>
                    <span className="truncate max-w-[120px]">{github.replace('https://', '')}</span>
                  </span>
                )}
                {portfolio && (
                  <span className="flex items-center gap-1">
                    <span className="text-teal-605 font-bold text-emerald-600">PORTFOLIO:</span>
                    <span className="truncate max-w-[120px]">{portfolio.replace('https://', '')}</span>
                  </span>
                )}
                {leetcode && (
                  <span className="flex items-center gap-1">
                    <span className="text-orange-500 font-bold">LEETCODE:</span>
                    <span className="truncate max-w-[120px]">{leetcode.replace('https://', '')}</span>
                  </span>
                )}
              </div>

              {/* Professional Summary */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold tracking-wider uppercase text-slate-700 border-b border-slate-100 pb-1">Professional Summary</h4>
                <p className="text-[11px] leading-relaxed text-slate-600 text-justify">{summary || 'Complete details of candidate career path.'}</p>
              </div>

              {/* Core Skill stacks */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold tracking-wider uppercase text-slate-700 border-b border-slate-100 pb-1">Technical Skills Inventory</h4>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {skillsText.split(',').map((skill, idx) => (
                    <span key={idx} className="bg-slate-100 border border-slate-200 text-slate-700 rounded px-2 py-0.5 text-[9px] font-semibold">
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Work Experience mapping loops */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold tracking-wider uppercase text-slate-700 border-b border-slate-100 pb-1">Professional Experience</h4>
                <div className="space-y-2">
                  {getExperienceLines().map((exp, idx) => (
                    <div key={idx} className="flex gap-2 items-start text-[10px] leading-relaxed">
                      <span className="text-indigo-650 font-bold block mt-0.5">•</span>
                      <p className="text-slate-600 flex-1">{exp.trim()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects details listing */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold tracking-wider uppercase text-slate-700 border-b border-slate-100 pb-1">Key Tech Projects</h4>
                <div className="space-y-2">
                  {getProjectLines().map((proj, idx) => (
                    <div key={idx} className="flex gap-2 items-start text-[10px] leading-relaxed">
                      <span className="text-indigo-650 font-bold block mt-0.5">•</span>
                      <p className="text-slate-600 flex-1">{proj.trim()}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Footer accents */}
            <div className="border-t border-slate-200 pt-3 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Generated via MailPilot Outreach & Resume Optimization Agent Suite
            </div>
            
          </div>
        </div>

      </div>

    </div>
  );
}
