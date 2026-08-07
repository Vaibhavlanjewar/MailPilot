import React, { useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * Drill-down for one topic inside a roadmap step.
 *
 * Explanations are cached by the parent and passed back in, so reopening a
 * topic is instant and doesn't spend another AI call — these are rate limited,
 * and the content is stable enough that regenerating adds nothing.
 */
export default function TopicDetailPanel({ roadmapId, topic, stepTitle, cached, onCache, onClose }) {
  const [detail, setDetail] = useState(cached || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cached) {
      setDetail(cached);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    api
      .post(`/roadmaps/${roadmapId}/explain`, { topic, stepTitle })
      .then(({ data }) => {
        if (cancelled) return;
        setDetail(data.detail);
        onCache(topic, data.detail);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this topic.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // onCache is stable via useCallback in the parent; including it would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmapId, topic, stepTitle, cached]);

  // Escape to close is expected of anything modal.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-app-surface shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-surface-border bg-app-surface p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Topic</p>
            <h3 className="mt-0.5 text-lg font-bold text-app">{topic}</h3>
            {stepTitle && <p className="mt-0.5 text-xs text-app-muted">in “{stepTitle}”</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-semibold text-app-muted transition hover:text-app"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 p-5">
          {loading && <p className="text-sm text-app-muted">Working through this topic…</p>}

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}

          {detail && (
            <>
              <p className="text-sm leading-relaxed text-app">{detail.explanation}</p>

              {detail.keyPoints?.length > 0 && (
                <Section title="Key points">
                  <ul className="space-y-1.5">
                    {detail.keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed text-app">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {detail.subtopics?.length > 0 && (
                <Section title="Break it down">
                  <div className="space-y-2">
                    {detail.subtopics.map((sub, i) => (
                      <div key={i} className="rounded-xl border border-surface-border bg-default-bg p-3">
                        <p className="text-sm font-semibold text-app">{sub.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-app-muted">{sub.detail}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {detail.example && (
                <Section title="Example">
                  <pre className="overflow-x-auto rounded-xl border border-surface-border bg-default-bg p-3 text-xs leading-relaxed text-app">
                    {detail.example}
                  </pre>
                </Section>
              )}

              {detail.pitfalls?.length > 0 && (
                <Section title="Common mistakes">
                  <ul className="space-y-1.5">
                    {detail.pitfalls.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed text-app">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {detail.interviewAngle && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    In interviews
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-app">{detail.interviewAngle}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-app-muted">{title}</h4>
      {children}
    </div>
  );
}
