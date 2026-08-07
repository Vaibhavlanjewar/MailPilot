import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

const STARTERS = [
  'Where should I start if I only have 5 hours a week?',
  'Which stage matters most for landing interviews?',
  'What can I safely skip given my background?',
  'How do I prove these skills on my resume?',
];

/**
 * Q&A grounded in the roadmap on screen.
 *
 * History lives in component state and is sent with each request rather than
 * stored server-side: the conversation is scoped to one sitting with one
 * roadmap, and persisting it would mean a collection, retention rules, and a
 * migration for something nobody has asked to revisit later.
 */
export default function RoadmapChat({ roadmapId, goal }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  // New roadmap selected — the old conversation no longer applies.
  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [roadmapId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  async function ask(question) {
    const trimmed = question.trim();
    if (!trimmed || sending) return;

    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post(`/roadmaps/${roadmapId}/chat`, {
        question: trimmed,
        history,
      });
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: err.message || 'Could not answer that right now. Try again in a moment.',
          failed: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-app-surface shadow-sm">
      <div className="border-b border-surface-border p-5">
        <h3 className="text-base font-semibold text-app">Ask about this roadmap</h3>
        <p className="mt-0.5 text-xs text-app-muted">
          Answers are grounded in your goal{goal ? ` — “${goal}”` : ''} and the stages above.
        </p>
      </div>

      <div className="max-h-[26rem] space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && !sending && (
          <div className="space-y-2">
            <p className="text-xs text-app-muted">Not sure where to start?</p>
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="block w-full rounded-xl border border-surface-border bg-default-bg p-3 text-left text-sm text-app transition hover:border-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={[
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-app-gradient text-white'
                  : m.failed
                    ? 'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border border-surface-border bg-default-bg text-app',
              ].join(' ')}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-surface-border bg-default-bg px-4 py-2.5 text-sm text-app-muted">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 border-t border-surface-border p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this plan…"
          className="flex-1 rounded-xl border border-input-border bg-default-bg px-3 py-2 text-sm text-app outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="rounded-xl bg-app-gradient px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
