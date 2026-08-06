import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import ProviderBadge from '../components/ui/ProviderBadge';

// Four boards plus their algorithms are dead weight for anyone who never opens
// this tab, and the main bundle is already large — so load it on demand.
const AlgorithmPlayground = lazy(() => import('../components/playground/AlgorithmPlayground'));

const TABS = ['Prep Plan', 'Chat', 'Code Sandbox', 'Playground'];

export default function InterviewPrep() {
  // A shared game link (?game=<code>) should open straight into the playground.
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get('game') ? 'Playground' : 'Prep Plan',
  );
  const [jobDescription, setJobDescription] = useState('');
  const [resume, setResume] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);

  useEffect(() => {
    api
      .get('/resumes/me')
      .then(({ data }) => setResume(data.resume))
      .catch(() => {})
      .finally(() => setResumeLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Interview Prep</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-purple-100 md:text-base">
          Practice questions, an open-ended coach chat, and a live code sandbox — all grounded in
          your real resume and the role you're targeting.
        </p>
      </div>

      <ResumeSnapshot resume={resume} loading={resumeLoading} onUpdate={setResume} />

      <div>
        <label htmlFor="jd" className="block text-xs font-semibold uppercase tracking-wider text-app-muted">
          Job you're interviewing for
        </label>
        <textarea
          id="jd"
          rows={3}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description — role, responsibilities, required skills…"
          className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-1 rounded-xl bg-default-bg p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t ? 'bg-app-surface text-app shadow-soft' : 'text-app-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Prep Plan' && <PrepPlanTab jobDescription={jobDescription} onSwitchToChat={() => setTab('Chat')} />}
      {tab === 'Chat' && <ChatTab jobDescription={jobDescription} hasResume={Boolean(resume)} />}
      {tab === 'Code Sandbox' && <CodeSandboxTab />}
      {tab === 'Playground' && (
        <Suspense fallback={<p className="text-sm text-app-muted">Loading playground…</p>}>
          <AlgorithmPlayground />
        </Suspense>
      )}
    </div>
  );
}

function ResumeSnapshot({ resume, loading, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(resume?.content || '');
    setEditing(true);
  }

  async function save() {
    if (!draft.trim()) {
      toast.info('Resume content cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/resumes/me', {
        title: resume?.title || 'My resume',
        source: resume?.source || 'paste',
        content: draft,
      });
      onUpdate(data.resume);
      setEditing(false);
      toast.success('Resume updated — search index refreshed.');
    } catch (err) {
      toast.error(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-app-muted">Loading your resume…</p>;
  }

  if (!resume) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-5 text-center">
        <p className="text-sm font-semibold text-app">No resume on file</p>
        <p className="mt-1 text-xs text-app-muted">
          Prep works better once we know your real skills and experience.
        </p>
        <Link
          to="/app/resume"
          className="mt-3 inline-block rounded-xl bg-app-gradient px-4 py-2 text-xs font-semibold text-white"
        >
          Add your resume
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-app">
          Your resume — skills, education &amp; experience
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="shrink-0 rounded-xl bg-app-muted px-3 py-1.5 text-xs font-semibold text-app hover:opacity-80"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            rows={10}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-app-gradient px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & re-index'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl bg-app-muted px-4 py-2 text-xs font-semibold text-app"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-app-muted">
          {resume.content}
        </p>
      )}
    </div>
  );
}

function PrepPlanTab({ jobDescription, onSwitchToChat }) {
  const [loading, setLoading] = useState(false);
  const [focusArea, setFocusArea] = useState('');
  const [prepQuestions, setPrepQuestions] = useState([]);
  const [provider, setProvider] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  async function handleGenerate() {
    if (!jobDescription.trim()) {
      toast.info('Paste the target job description above first.');
      return;
    }
    setLoading(true);
    setFocusArea('');
    setPrepQuestions([]);
    try {
      const { data } = await api.post('/ai/interview-prep', { jobDescription: jobDescription.trim() });
      setFocusArea(data.focus || '');
      setPrepQuestions(data.questions || []);
      setProvider(data.provider || null);
    } catch (err) {
      toast.error(err.message || 'Could not generate prep questions.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-app">Staged questions</h2>
          <p className="mt-1 text-xs text-app-muted">
            A quick-start set. Open the Chat tab to go deeper on any of these — unlimited follow-ups.
          </p>
        </div>
        <ProviderBadge provider={provider} />
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-app-gradient py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Generate practice questions'}
      </button>

      {focusArea && (
        <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-50 p-4 dark:bg-purple-950/30">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
            Focus area
          </h3>
          <p className="mt-1 text-sm text-app">{focusArea}</p>
        </div>
      )}

      {prepQuestions.length > 0 && (
        <div className="mt-4 space-y-2">
          {prepQuestions.map((q) => {
            const open = expandedId === q.id;
            return (
              <div key={q.id} className="overflow-hidden rounded-xl border border-surface-border bg-default-bg">
                <button
                  onClick={() => setExpandedId(open ? null : q.id)}
                  className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold text-app hover:bg-app-hover"
                >
                  <span>Q{q.id}: {q.question}</span>
                  <svg className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-surface-border bg-app-surface p-4 text-xs">
                    <div>
                      <span className="mb-1 block font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        Answer strategy
                      </span>
                      <p className="leading-relaxed text-app-muted">{q.tips}</p>
                    </div>
                    <div>
                      <span className="mb-1 block font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Sample response
                      </span>
                      <blockquote className="rounded-r-lg border-l-2 border-emerald-500 bg-default-bg py-1 pl-3 italic text-app">
                        "{q.sampleAnswer}"
                      </blockquote>
                    </div>
                    <button
                      onClick={onSwitchToChat}
                      className="text-primary hover:underline"
                    >
                      Discuss this question in Chat →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatTab({ jobDescription, hasResume }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [provider, setProvider] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const nextMessages = [...messages, { role: 'user', content: trimmed }];
      setMessages(nextMessages);
      setInput('');
      setSending(true);

      try {
        const { data } = await api.post('/ai/interview-chat', {
          jobDescription,
          message: trimmed,
          history: messages,
        });
        setMessages([...nextMessages, { role: 'coach', content: data.reply }]);
        setProvider(data.provider || null);
      } catch (err) {
        toast.error(err.message || 'The coach is unavailable right now.');
        setMessages(nextMessages);
      } finally {
        setSending(false);
      }
    },
    [messages, sending, jobDescription],
  );

  const starters = [
    'Quiz me on this role, one question at a time.',
    'What are the biggest gaps between my resume and this job?',
    'Ask me a system design question for this role.',
    'How should I answer "tell me about yourself" for this job?',
  ];

  return (
    <div className="flex h-[600px] flex-col rounded-2xl border border-surface-border bg-app-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-surface-border p-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-app">Coach chat</h2>
          <p className="text-xs text-app-muted">
            Keep going as long as you want — there's no message limit.
          </p>
        </div>
        <ProviderBadge provider={provider} />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-app">Start the conversation</p>
            <p className="mt-1 max-w-sm text-xs text-app-muted">
              {hasResume
                ? 'The coach knows your resume and the job description above.'
                : 'Add your resume under My Resume for better-grounded answers.'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-surface-border px-3 py-1.5 text-xs font-medium text-app-muted hover:border-primary hover:text-app"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-app-gradient text-white'
                  : 'border border-surface-border bg-default-bg text-app'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-default-bg px-4 py-2.5 text-sm text-app-muted">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-surface-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything, or say 'quiz me'…"
          className="flex-1 rounded-xl border border-input-border bg-transparent px-3 py-2.5 text-sm text-app outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-xl bg-app-gradient px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

const SANDBOX_TIMEOUT_MS = 5000;
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

/**
 * JS runs inside a sandboxed Web Worker — separate global scope, no access to
 * this page's DOM, localStorage, or auth token. A hard timeout kills runaway
 * loops instead of hanging the tab.
 */
function runJavaScript(code) {
  return new Promise((resolve) => {
    const workerSource = `
      self.onmessage = (e) => {
        const logs = [];
        const push = (...args) => logs.push(args.map(a => {
          try { return typeof a === 'string' ? a : JSON.stringify(a); }
          catch { return String(a); }
        }).join(' '));
        console.log = push;
        console.error = push;
        console.warn = push;
        try {
          (0, eval)(e.data);
          self.postMessage({ stdout: logs.join('\\n'), stderr: '' });
        } catch (err) {
          self.postMessage({ stdout: logs.join('\\n'), stderr: String(err && err.stack || err) });
        }
      };
    `;
    const blob = new Blob([workerSource], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ stdout: '', stderr: `Timed out after ${SANDBOX_TIMEOUT_MS / 1000}s — check for an infinite loop.` });
    }, SANDBOX_TIMEOUT_MS);

    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ stdout: '', stderr: e.message || 'Worker error' });
    };
    worker.postMessage(code);
  });
}

let pyodideLoadPromise = null;
function loadPyodide() {
  if (window.pyodide) return Promise.resolve(window.pyodide);
  if (pyodideLoadPromise) return pyodideLoadPromise;

  pyodideLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PYODIDE_CDN;
    script.onload = async () => {
      try {
        window.pyodide = await window.loadPyodide();
        resolve(window.pyodide);
      } catch (err) {
        reject(err);
      }
    };
    script.onerror = () => reject(new Error('Could not load the Python runtime from CDN.'));
    document.head.appendChild(script);
  });
  return pyodideLoadPromise;
}

async function runPython(code) {
  const pyodide = await loadPyodide();
  pyodide.runPython('import sys, io\nsys.stdout = io.StringIO()\nsys.stderr = io.StringIO()');
  let stderr = '';
  try {
    await pyodide.runPythonAsync(code);
  } catch (err) {
    stderr = String(err);
  }
  const stdout = pyodide.runPython('sys.stdout.getvalue()');
  const capturedErr = pyodide.runPython('sys.stderr.getvalue()');
  return { stdout, stderr: [capturedErr, stderr].filter(Boolean).join('\n') };
}

/** Python and JS execute locally (Pyodide/Worker); these three go through the self-hosted sandbox API. */
const SERVER_LANGUAGES = new Set(['c', 'cpp', 'java']);

const STARTER_SNIPPETS = {
  python: 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []\n\nprint(two_sum([2, 7, 11, 15], 9))\n',
  javascript: 'function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n\nconsole.log(twoSum([2, 7, 11, 15], 9));\n',
  c: '#include <stdio.h>\n\nint main() {\n    int nums[] = {2, 7, 11, 15};\n    int target = 9;\n    for (int i = 0; i < 4; i++) {\n        for (int j = i + 1; j < 4; j++) {\n            if (nums[i] + nums[j] == target) {\n                printf("[%d, %d]\\n", i, j);\n                return 0;\n            }\n        }\n    }\n    return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    vector<int> nums = {2, 7, 11, 15};\n    int target = 9;\n    unordered_map<int, int> seen;\n    for (int i = 0; i < (int)nums.size(); i++) {\n        int need = target - nums[i];\n        if (seen.count(need)) {\n            cout << "[" << seen[need] << ", " << i << "]" << endl;\n            return 0;\n        }\n        seen[nums[i]] = i;\n    }\n    return 0;\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    int[] nums = {2, 7, 11, 15};\n    int target = 9;\n    Map<Integer, Integer> seen = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n      if (seen.containsKey(target - nums[i])) {\n        System.out.println("[" + seen.get(target - nums[i]) + ", " + i + "]");\n        return;\n      }\n      seen.put(nums[i], i);\n    }\n  }\n}\n',
};

function CodeSandboxTab() {
  const [language, setLanguage] = useState('python');
  const [source, setSource] = useState(STARTER_SNIPPETS.python);
  const [running, setRunning] = useState(false);
  const [pyLoading, setPyLoading] = useState(false);
  const [result, setResult] = useState(null);

  function handleLanguageChange(e) {
    const lang = e.target.value;
    setLanguage(lang);
    setSource(STARTER_SNIPPETS[lang] || '');
    setResult(null);
  }

  async function run() {
    if (!source.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      if (language === 'python' && !window.pyodide) setPyLoading(true);

      let output;
      if (language === 'python') {
        output = await runPython(source);
      } else if (language === 'javascript') {
        output = await runJavaScript(source);
      } else {
        const { data } = await api.post('/code/execute', { language, source });
        output = {
          stdout: data.run.stdout,
          stderr: [data.compile?.stderr, data.run.stderr].filter(Boolean).join('\n'),
        };
      }
      setResult(output);
    } catch (err) {
      toast.error(err.message || 'Execution failed.');
    } finally {
      setRunning(false);
      setPyLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-surface-border bg-app-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <select
            value={language}
            onChange={handleLanguageChange}
            className="rounded-xl border border-input-border bg-transparent px-3 py-2 text-sm text-app outline-none focus:border-primary"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
          </select>
          <button
            onClick={run}
            disabled={running}
            className="rounded-xl bg-app-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pyLoading ? 'Loading Python…' : running ? 'Running…' : 'Run ▶'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-app-muted">
          {SERVER_LANGUAGES.has(language)
            ? `${language.toUpperCase()} compiles on a hosted sandbox (Judge0) — needs a network connection.`
            : 'Runs entirely in your browser — no server, no limits, nothing leaves your machine.'}
        </p>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          rows={16}
          className="mt-3 block w-full rounded-xl border border-input-border bg-default-bg p-3 font-mono text-xs text-app outline-none focus:border-primary"
        />
      </div>

      <div className="rounded-2xl border border-surface-border bg-app-surface p-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-app-muted">Output</h3>
        {!result && !running && (
          <p className="mt-4 text-xs text-app-muted">Run your code to see output here.</p>
        )}
        {running && (
          <p className="mt-4 text-xs text-app-muted">
            {pyLoading ? 'Downloading Python runtime (first run only)…' : 'Executing…'}
          </p>
        )}
        {result && (
          <div className="mt-3 space-y-3">
            {result.stdout && (
              <div>
                <p className="text-[10px] font-bold uppercase text-emerald-500">Stdout</p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-default-bg p-3 font-mono text-xs text-app">
                  {result.stdout}
                </pre>
              </div>
            )}
            {result.stderr && (
              <div>
                <p className="text-[10px] font-bold uppercase text-rose-500">Stderr</p>
                <pre className="mt-1 overflow-x-auto rounded-xl bg-default-bg p-3 font-mono text-xs text-rose-600 dark:text-rose-400">
                  {result.stderr}
                </pre>
              </div>
            )}
            {!result.stdout && !result.stderr && (
              <p className="text-xs text-app-muted">Program produced no output.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
