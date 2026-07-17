import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import HtmlPreview from '../components/HtmlPreview';

export default function AiAssistant() {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code'

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

    const lowerName = file.name.toLowerCase();
    const reader = new FileReader();

    if (lowerName.endsWith('.pdf')) {
      toast.info('Extracting Text From PDF Resume...');
      reader.onload = async (event) => {
        try {
          const text = await parsePdf(event.target.result);
          if (!text.trim()) {
            toast.warning('Extraction completed but retrieved no text content.');
            return;
          }
          setResumeText(text.trim());
          toast.success('PDF Resume contents extracted successfully.');
        } catch (err) {
          console.error(err);
          toast.error('Failed to parse PDF Resume. Please try another format or copy and paste context text.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (lowerName.endsWith('.docx')) {
      toast.info('Extracting Text From Word Resume...');
      reader.onload = async (event) => {
        try {
          const text = await parseDocx(event.target.result);
          if (!text.trim()) {
            toast.warning('Extraction completed but retrieved no text content.');
            return;
          }
          setResumeText(text.trim());
          toast.success('Word Resume contents extracted successfully.');
        } catch (err) {
          console.error(err);
          toast.error('Failed to parse Docx resume.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (lowerName.endsWith('.txt')) {
      reader.onload = (event) => {
        setResumeText(event.target?.result || '');
        toast.success('Resume text loaded from file.');
      };
      reader.readAsText(file);
    } else {
      toast.error('Unsupported file format. Please upload .pdf, .docx, or .txt.');
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) {
      toast.info('Please enter the Job Description first.');
      return;
    }

    setLoading(true);
    setSubject('');
    setBodyHtml('');

    const formattedPrompt = `
Generate a personalized cold email template using:

[JOB DESCRIPTION]
${jobDescription.trim()}

[USER RESUME/EXPERIENCE]
${resumeText.trim() || 'No specific resume provided. Customize placeholder details.'}

[CUSTOM PROMPT / STYLE GUIDELINES]
${customPrompt.trim() || 'Keep it professional, direct, and under 200 words.'}
`.trim();

    try {
      const resp = await api.post('/templates/ai-generate', { prompt: formattedPrompt });
      if (resp.data?.subject && resp.data?.body) {
        setSubject(resp.data.subject);
        setBodyHtml(resp.data.body);
        
        // Auto-extract role/company to set template name default
        const compMatch = jobDescription.match(/\b(?:at|for|with)\s+([A-Z][A-Za-z0-9&.,' -]{1,20})/);
        const companyName = compMatch?.[1] ? compMatch[1].trim() : 'Company';
        setTemplateName(`AI Optimized: Application for ${companyName}`);
        
        toast.success('Successfully generated personalized template.');
      } else {
        toast.error('API succeeded but returned invalid output schema.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to communicate with AI generation endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.info('Nothing to save. Please generate a design first.');
      return;
    }
    if (!templateName.trim()) {
      toast.info('Please provide a name for your template.');
      return;
    }

    try {
      const payload = {
        name: templateName.trim(),
        subject: subject.trim(),
        body: bodyHtml.trim(),
        textContent: bodyHtml.replace(/<[^>]*>/g, ' ').trim(), // strip HTML for textContent fallback
      };
      await api.post('/templates', payload);
      toast.success(`Template "${templateName}" saved to your Templates manager.`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save template.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header and Branding Title */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI Recruiter Outreach</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 md:text-base">
          Optimize your response using Gemini Pro. Input the target Job Description and copy in your resume text to design a customized cold email that highlights your matching key skills.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Input Panel Card */}
        <div className="flex flex-col gap-5 rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm lg:col-span-5">
          <h2 className="text-lg font-semibold text-app">1. Customize Target & Candidate Profile</h2>
          
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label htmlFor="job-desc" className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                Job Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="job-desc"
                rows={5}
                required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none transitionfocus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Paste the job posting description here (Role title, responsibilities, skills requested...)"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                  Your Resume Text / Biography
                </label>
                <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  Upload PDF, Word or .txt
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
              <textarea
                rows={5}
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Paste core details from your CV (skills, qualifications, project experience...)"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-app-muted">
                Tip: Copy-paste the raw text of your PDF/Docx directly into this box for parsing.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                Custom Styling / Instructions (Optional)
              </label>
              <textarea
                rows={2}
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app opacity-80 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="e.g. 'Emphasize my Kubernetes credentials', 'Make it humorous', 'Keep it very short.'"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-gradient py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Optimizing Outlines...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904z" />
                  </svg>
                  <span>Build Pitch Email</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Panel Card */}
        <div className="flex flex-col rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm lg:col-span-7">
          <div className="flex items-center justify-between border-b border-surface-border pb-3">
            <h2 className="text-lg font-semibold text-app">2. Output Cover Email</h2>
            {bodyHtml && (
              <div className="flex rounded-lg bg-default-bg p-1">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    activeTab === 'preview' ? 'bg-white text-app shadow-soft' : 'text-app-muted'
                  }`}
                >
                  Visual Preview
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    activeTab === 'code' ? 'bg-white text-app shadow-soft' : 'text-app-muted'
                  }`}
                >
                  HTML Source
                </button>
              </div>
            )}
          </div>

          {!subject && !bodyHtml && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-app-muted">
              <svg className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h15m-16.5-6H19.5c.621 0 1.125.504 1.125 1.125v13.5c0 .621-.504 1.125-1.125 1.125H5.625c-.621 0-1.125-.504-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125z" />
              </svg>
              <h3 className="mt-4 text-sm font-semibold">Generate pitch text</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed">
                Provide target job details and press "Build Pitch Email" in the left panel to output your customized template.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-app-muted">
              <svg className="mx-auto h-12 w-12 animate-bounce text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904z" />
              </svg>
              <h3 className="mt-4 text-sm font-semibold">Consulting Gemini v1.5 API...</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed">
                Applying personalization tokens and compiling HTML layout format.
              </p>
            </div>
          )}

          {(subject || bodyHtml) && !loading && (
            <div className="mt-4 flex flex-1 flex-col space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Email Subject</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm font-medium text-app outline-none focus:border-primary"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Email body</label>
                <div className="mt-1 block h-96 w-full overflow-auto rounded-xl border border-input-border bg-transparent">
                  {activeTab === 'preview' ? (
                    <div className="p-4 bg-white text-black min-h-full">
                      <HtmlPreview html={bodyHtml} />
                    </div>
                  ) : (
                    <textarea
                      className="h-full w-full bg-slate-900 p-4 text-xs font-mono text-green-400 outline-none"
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="border-t border-surface-border pt-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Save as Reusable Template</label>
                <div className="mt-1 flex gap-3">
                  <input
                    type="text"
                    className="block flex-1 rounded-xl border border-input-border bg-transparent px-3 py-2 text-sm text-app outline-none focus:border-primary"
                    placeholder="Enter template name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!templateName.trim()}
                    className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-soft hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
