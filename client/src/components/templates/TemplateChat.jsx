import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

const STARTERS = [
  'Make this shorter and more direct',
  'Make the tone more confident without sounding arrogant',
  'Emphasize backend and system design experience',
  'Rewrite the opening line so it does not sound generic',
];

/**
 * Conversational refinement of the template currently in the editor —
 * distinct from the "Customize with AI" box above it, which generates fresh
 * content from a prompt/JD. This edits what's already there, one request at
 * a time, while being explicitly instructed (server-side) not to touch any
 * inserted signature or project-links block — the generic generate endpoint
 * has no such guarantee, so routing edits through this instead of a
 * follow-up prompt on that endpoint is what keeps an inserted signature safe.
 *
 * subject/body are read fresh on every send (not captured once), so edits
 * made directly in the textarea between chat turns are included.
 */
export default function TemplateChat({ getSubject, getBody, onApply }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  async function ask(instruction) {
    const trimmed = instruction.trim();
    if (!trimmed || sending) return;

    const subject = getSubject();
    const body = getBody();
    if (!subject.trim() && !body.trim()) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Write or generate a draft first, then I can help refine it.', failed: true },
      ]);
      return;
    }

    const history = messages;
    setMessages((m) => [...m, { role: 'user', content: trimmed }]);
    setInput('');
    setSending(true);

    try {
      const { data } = await api.post('/templates/chat', { subject, body, message: trimmed, history });
      onApply(data.subject, data.body);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: err.message || 'Could not apply that change. Try again.', failed: true },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-muted/40 p-4">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Chat to refine this template</h4>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
        Ask for a specific change — tone, length, emphasis. Your inserted signature and project
        links (if any) are left untouched.
      </p>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {messages.length === 0 && !sending && (
          <div className="space-y-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="block w-full rounded-lg border border-surface-border bg-app-surface p-2.5 text-left text-xs text-app transition hover:border-primary"
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
                'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                m.role === 'user'
                  ? 'bg-app-gradient text-white'
                  : m.failed
                    ? 'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border border-surface-border bg-app-surface text-app',
              ].join(' ')}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-surface-border bg-app-surface px-3 py-2 text-xs text-app-muted">
              Applying…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/*
        Deliberately a <div>, not a <form>: this panel is always mounted
        inside the template's own save <form> (TemplateEditor / CreateCampaign),
        and a nested <form> is invalid HTML — its submit event still bubbles
        to the outer form's onSubmit, which silently triggered "Save Template"
        (and navigated away) every time a chat message was sent, before the
        AI's reply could ever be applied. Enter-to-send is handled directly
        on the input instead of via native form submission.
      */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            ask(input);
          }}
          placeholder="e.g. Make the second paragraph more concise"
          className="flex-1 rounded-lg border border-input-border bg-transparent px-3 py-2 text-xs text-app outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => ask(input)}
          disabled={!input.trim() || sending}
          className="rounded-lg bg-app-gradient px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
