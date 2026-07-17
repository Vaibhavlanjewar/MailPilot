import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function InterviewPrep() {
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);

  // Analysis result states
  const [focusArea, setFocusArea] = useState('');
  const [prepQuestions, setPrepQuestions] = useState([]);
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // File loading hooks
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
          toast.error('Failed to parse PDF.');
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

  const handleGeneratePrep = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) {
      toast.info('Please enter the target Job Description first.');
      return;
    }

    setLoading(true);
    setFocusArea('');
    setPrepQuestions([]);

    try {
      const resp = await api.post('/ai/interview-prep', {
        jobDescription: jobDescription.trim(),
        resumeText: resumeText.trim()
      });

      if (resp.data) {
        setFocusArea(resp.data.focus || 'Ensure general knowledge of tech stack and design patterns.');
        setPrepQuestions(resp.data.questions || []);
        toast.success('Generated your personalized interview prep guide plan.');
      } else {
        toast.error('Invalid response format.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error occurred connecting to the AI prep coordinator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header Panel */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI Interview Prep Assistant</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-purple-100 md:text-base">
          Get interview ready. Submit any job description with your resume to generate target technical questions, candidate context tips, and customized sample answers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Input Box */}
        <div className="flex flex-col gap-5 rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm lg:col-span-5">
          <h2 className="text-lg font-semibold text-app">1. Load Job & Resume context</h2>
          
          <form onSubmit={handleGeneratePrep} className="space-y-4">
            <div>
              <label htmlFor="jd-prep" className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                Job Description *
              </label>
              <textarea
                id="jd-prep"
                rows={5}
                required
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
                placeholder="Paste the target job description (skills, responsibilities, role specs)..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
                  Your Resume Content
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
                className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
                placeholder="Paste details of your background qualifications or upload cv file..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-gradient py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Consulting Interview AI Companion...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904z" />
                  </svg>
                  <span>Generate Prep Plan</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Output Panel */}
        <div className="flex flex-col rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm lg:col-span-7">
          <h2 className="text-lg font-semibold text-app border-b border-surface-border pb-3">
            2. Interview Preparation Guide
          </h2>

          {!focusArea && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-app-muted">
              <svg className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.9c4.956-1.936 8.23-6.662 8.23-11.89m-16.46 0A12.012 12.012 0 0112 3c1.933 0 3.702.458 5.27 1.258m-13.01 5.89h10.56" />
              </svg>
              <h3 className="mt-4 text-sm font-semibold">Ready to Train</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed">
                Provide the target job specifications and load your CV to compile structural practice drills.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-app-muted">
              <svg className="mx-auto h-12 w-12 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <h3 className="mt-4 text-sm font-semibold">Generating customized prep plan...</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed">
                Reviewing job requirements, parsing key skills, and mapping expected interview questions.
              </p>
            </div>
          )}

          {focusArea && !loading && (
            <div className="mt-4 space-y-5">
              {/* Focus Banner Callout */}
              <div className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-500/20 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Core Subject Review Focus</h3>
                <p className="mt-1 text-sm text-app">{focusArea}</p>
              </div>

              {/* Questions Accordion */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted">Staged Interview Questions</h3>
                {prepQuestions.map((q) => {
                  const isExpanded = expandedQuestionId === q.id;
                  return (
                    <div key={q.id} className="rounded-xl border border-surface-border bg-default-bg overflow-hidden transition">
                      <button
                        onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                        className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm text-app hover:bg-app-hover transition"
                      >
                        <span>Q{q.id}: {q.question}</span>
                        <svg className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="p-4 bg-app-surface border-t border-surface-border space-y-3 font-medium text-xs">
                          <div>
                            <span className="text-purple-600 dark:text-purple-450 uppercase font-bold tracking-wider block mb-1">Answer Strategy Tips:</span>
                            <p className="text-app-muted leading-relaxed">{q.tips}</p>
                          </div>
                          <div>
                            <span className="text-teal-605 dark:text-teal-400 uppercase font-bold tracking-wider block mb-1 text-emerald-650">Sample Candidate Elevator Response:</span>
                            <blockquote className="border-l-2 border-emerald-500 pl-3 py-1 italic bg-default-bg text-app leading-relaxed rounded-r-lg">
                              "{q.sampleAnswer}"
                            </blockquote>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
