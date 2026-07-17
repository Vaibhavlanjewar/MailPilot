import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function ResumeRag() {
  const location = useLocation();
  const passedResumeId = location.state?.resumeId;

  const [resumesList, setResumesList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  
  // Selected Profile state
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [selectedResume, setSelectedResume] = useState(null);
  
  // Chunking visualizer states
  const [chunks, setChunks] = useState([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  
  // RAG Chat queries
  const [query, setQuery] = useState('');
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  
  // Sources highlighted
  const [matchedSourceIds, setMatchedSourceIds] = useState([]);

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    setLoadingList(true);
    try {
      const resp = await api.get('/resumes');
      if (resp.data?.success && resp.data.resumes) {
        setResumesList(resp.data.resumes);
        if (resp.data.resumes.length > 0) {
          const target = passedResumeId 
            ? resp.data.resumes.find(r => r.id === passedResumeId) 
            : null;
          selectResumeObject(target || resp.data.resumes[0]);
        }
      }
    } catch (err) {
      console.warn("Failed fetching resumes index:", err);
      toast.warning("Could not sync with Cloud storage. Working in text input mode.");
    } finally {
      setLoadingList(false);
    }
  };

  const selectResumeObject = async (resume) => {
    setSelectedResume(resume);
    setSelectedResumeId(resume.id);
    setMatchedSourceIds([]);
    await fetchChunksForText(resume.content);
  };

  const handleResumeChange = (e) => {
    const resId = e.target.value;
    const found = resumesList.find(r => r.id === resId);
    if (found) {
      selectResumeObject(found);
    }
  };

  const fetchChunksForText = async (text) => {
    setLoadingChunks(true);
    try {
      const resp = await api.post('/ai/rag/chunks', { resumeText: text });
      if (resp.data?.success && resp.data.chunks) {
        setChunks(resp.data.chunks);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate text chunking segments.");
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleRagQuerySubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.info("Please enter a question or query string.");
      return;
    }

    if (!selectedResume && !selectedResumeId) {
      toast.info("Please upload a resume or select a template profile.");
      return;
    }

    setLoadingQuery(true);
    setMatchedSourceIds([]);

    const payload = {
      query: query.trim()
    };

    if (selectedResumeId) {
      payload.resumeId = selectedResumeId;
    } else {
      payload.resumeText = selectedResume.content;
    }

    try {
      const resp = await api.post('/ai/rag/query', payload);
      if (resp.data && resp.data.success) {
        const { answer, criticalKeywords, recommendedAction, sources } = resp.data;
        
        // Match response sources indexes to highlight chunks
        const sourceIndexes = (sources || []).map(s => s.index);
        setMatchedSourceIds(sourceIndexes);

        const chatAnswer = {
          id: `chat-${Date.now()}`,
          question: query.trim(),
          answer,
          criticalKeywords: criticalKeywords || [],
          recommendedAction: recommendedAction || "",
          sources: sources || []
        };

        setChatHistory(prev => [chatAnswer, ...prev]);
        setQuery('');
        toast.success("Semantic retrieval successful.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Error querying resume database.");
    } finally {
      setLoadingQuery(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header and Branding Title */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-700 via-emerald-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Resume Semantic RAG & Chunking Copilot</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-100 md:text-base">
          Query your stored documents using Retrieval-Augmented Generation. View structural backend overlap chunks and search key metrics dynamically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Control Panel: Stored files selection & live RAG inquiry */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Document selection */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-app border-b border-surface-border pb-2">Target Document</h2>
            
            {loadingList ? (
              <p className="text-xs text-app-muted">Querying resume database index...</p>
            ) : resumesList.length === 0 ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-app-muted italic">No cloud CV records found. Go to the "Resume Builder" page to upload or save documents to Firestore first.</p>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted mb-1">Select Resumes Database Instance</label>
                <select
                  value={selectedResumeId}
                  onChange={handleResumeChange}
                  className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary dark:bg-slate-900"
                >
                  {resumesList.map((res) => (
                    <option key={res.id} value={res.id}>{res.title} ({res.type === 'built' ? 'Built Editor' : 'Uploaded file'})</option>
                  ))}
                </select>
              </div>
            )}
            
            {selectedResume && (
              <div className="bg-default-bg/50 border border-surface-border rounded-xl p-3 text-xs space-y-1">
                <p className="font-bold text-app uppercase text-[9px] tracking-wider text-primary">Metadata stats</p>
                <p className="text-app-muted truncate">Name: <span className="font-semibold text-app">{selectedResume.title}</span></p>
                <p className="text-app-muted">Character count: <span className="font-semibold text-app">{selectedResume.content.length}</span></p>
                <p className="text-app-muted">Word count: <span className="font-semibold text-app">{selectedResume.content.split(/\s+/).filter(Boolean).length}</span></p>
              </div>
            )}
          </div>

          {/* Ask AI RAG Search block */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-app border-b border-surface-border pb-2">RAG Search Query</h2>
            
            <form onSubmit={handleRagQuerySubmit} className="space-y-3">
              <div>
                <label htmlFor="rag-query-input" className="block text-[10px] font-bold uppercase text-app-muted mb-1">Ask anything to your resume</label>
                <textarea
                  id="rag-query-input"
                  rows={4}
                  required
                  placeholder="e.g. 'List my projects where I used Docker', 'Summarize my team management responsibilities', 'What programming languages did I mention?'"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="block w-full rounded-xl border border-input-border bg-transparent p-3 text-xs text-app outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loadingQuery || !selectedResume}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-app-gradient py-2.5 text-xs font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50"
              >
                {loadingQuery ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Extracting Semantics...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" />
                    </svg>
                    <span>Execute RAG Query</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Right pane: split client panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Visual Chunk visualizer section */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-surface-border pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-app">Document Chunking Grid Visualizer</h2>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                Overlap Splits : 400 words density
              </span>
            </div>

            {loadingChunks ? (
              <p className="text-xs text-app-muted">Calculating sliding text boundaries...</p>
            ) : chunks.length === 0 ? (
              <p className="text-xs text-app-muted italic text-center py-4">No active document segments currently indexed.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto p-1 scrollbar-thin">
                {chunks.map((chk) => {
                  const isMatched = matchedSourceIds.includes(chk.id);
                  return (
                    <div 
                      key={chk.id} 
                      className={`p-3 rounded-xl border text-[11px] leading-relaxed transition ${
                        isMatched 
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
                          : 'bg-default-bg border-surface-border hover:border-slate-400'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1 pb-1 border-b border-surface-border/40 text-[9px] font-bold text-app-muted">
                        <span className={isMatched ? 'text-emerald-600 font-bold' : ''}>
                          {isMatched ? '✓ MATCHER SOURCE' : `SEGMENT CHUNK #${chk.id}`}
                        </span>
                        <span>{chk.wordCount} Words | {chk.characterCount} Chars</span>
                      </div>
                      <p className="text-app line-clamp-3 text-justify select-none">{chk.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RAG Chat Results feedback list */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4 flex-1 flex flex-col min-h-[350px]">
            <h2 className="text-sm font-bold uppercase tracking-wider text-app border-b border-surface-border pb-3">Retrieval Answers Stream</h2>
            
            {chatHistory.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-app-muted">
                <svg className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12h9m-9 3.75h9m-9 3.75h3m-6 3.75h12A2.25 2.25 0 0022 20.25V3.75A2.25 2.25 0 0019.5 1.5h-15A2.25 2.25 0 002.25 3.75v16.5A2.25 2.25 0 004.5 22.5z" />
                </svg>
                <h3 className="mt-4 text-xs font-bold text-app uppercase">No queries fired yet</h3>
                <p className="mt-1 text-xs max-w-xs mx-auto leading-relaxed">
                  Enter target metrics on the search panel to see grounded context answers dynamically.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {chatHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-surface-border bg-default-bg p-4 space-y-3 shadow-soft hover:shadow-md transition">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-surface-border pb-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-primary uppercase">Query</span>
                        <p className="text-xs font-bold text-app leading-normal">"{item.question}"</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">RAG Grounded</span>
                    </div>

                    {/* Answer Generated */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-teal-650 dark:text-teal-400 uppercase block">Contextual AI Response Synthesis</span>
                      <p className="text-[11px] leading-relaxed text-app text-justify leading-relaxed">{item.answer}</p>
                    </div>

                    {/* Meta stats keywords & optimize notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surface-border/50 text-[10px]">
                      {item.criticalKeywords.length > 0 && (
                        <div className="space-y-1">
                          <span className="font-bold text-app-muted uppercase">Query Keywords Extracted</span>
                          <div className="flex flex-wrap gap-1">
                            {item.criticalKeywords.map((k, i) => (
                              <span key={i} className="bg-primary/5 border border-primary/20 text-primary rounded px-2 py-0.2 text-[9px] font-bold">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {item.recommendedAction && (
                        <div className="space-y-1">
                          <span className="font-bold text-app-muted uppercase">Advisory Action Plan</span>
                          <p className="text-app leading-normal italic text-slate-500">"{item.recommendedAction}"</p>
                        </div>
                      )}
                    </div>

                    {/* Sources citations detail */}
                    {item.sources.length > 0 && (
                      <div className="mt-3 bg-app-surface/60 border border-surface-border/80 rounded-xl p-2.5 text-[9px] space-y-1.5">
                        <span className="block font-bold text-app-muted uppercase tracking-wider">CITED REFERENCES ({item.sources.length})</span>
                        <div className="space-y-1 pl-1">
                          {item.sources.map((src, i) => (
                            <div key={i} className="text-app-muted leading-relaxed font-mono">
                              <span className="text-emerald-500 font-bold">SEGMENT #{src.index} (Score: {(src.score * 100).toFixed(0)}%)</span> — "{src.text.slice(0, 140).trim()}..."
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
