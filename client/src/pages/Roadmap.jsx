import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';
import ProviderBadge from '../components/ui/ProviderBadge';
import TopicDetailPanel from '../components/roadmap/TopicDetailPanel';
import RoadmapChat from '../components/roadmap/RoadmapChat';

const PRESETS = [
  'Backend engineer at a fintech company',
  'Full stack developer (MERN)',
  'Data engineer',
  'DevOps / platform engineer',
  'Machine learning engineer',
];

function progressOf(roadmap) {
  const steps = (roadmap.stages || []).flatMap((s) => s.steps || []);
  if (!steps.length) return 0;
  return Math.round((steps.filter((s) => s.completed).length / steps.length) * 100);
}

export default function Roadmap() {
  const [roadmaps, setRoadmaps] = useState([]);
  const [active, setActive] = useState(null);
  const [goal, setGoal] = useState('');
  const [useResume, setUseResume] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openTopic, setOpenTopic] = useState(null); // { topic, stepTitle }
  // Explanations are stable and rate-limited, so reopening a topic reuses the
  // first answer instead of spending another call.
  const [topicCache, setTopicCache] = useState({});

  const cacheTopic = useCallback((topic, detail) => {
    setTopicCache((prev) => ({ ...prev, [topic]: detail }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/roadmaps');
      setRoadmaps(data.roadmaps || []);
      setActive((prev) => prev || data.roadmaps?.[0] || null);
    } catch (err) {
      toast.error(err.message || 'Could not load roadmaps.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate(e) {
    e.preventDefault();
    if (!goal.trim()) {
      toast.info('Describe what you want to learn.');
      return;
    }

    setGenerating(true);
    try {
      const { data } = await api.post('/roadmaps', { goal: goal.trim(), useResume });
      setActive(data.roadmap);
      setRoadmaps((prev) => [data.roadmap, ...prev]);
      setGoal('');
      toast.success(
        data.roadmap.personalised
          ? 'Roadmap built and tailored to your resume.'
          : 'Roadmap built.',
      );
    } catch (err) {
      toast.error(err.message || 'Could not generate the roadmap.');
    } finally {
      setGenerating(false);
    }
  }

  async function toggleStep(stepId, completed) {
    if (!active) return;
    // Optimistic: the checkbox should feel instant.
    setActive((prev) => ({
      ...prev,
      stages: prev.stages.map((st) => ({
        ...st,
        steps: st.steps.map((s) => (s.id === stepId ? { ...s, completed } : s)),
      })),
    }));

    try {
      await api.patch(`/roadmaps/${active._id}/steps/${stepId}`, { completed });
    } catch (err) {
      toast.error(err.message || 'Could not save progress.');
      load();
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/roadmaps/${id}`);
      setRoadmaps((prev) => prev.filter((r) => r._id !== id));
      setActive((prev) => (prev?._id === id ? null : prev));
      toast.success('Roadmap deleted.');
    } catch (err) {
      toast.error(err.message || 'Could not delete the roadmap.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Learning Roadmap</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-100 md:text-base">
          Generate a staged, dependency-ordered path to your target role. If you have a resume
          saved, topics you already know are marked so you can skip them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
            <h2 className="border-b border-surface-border pb-2 text-sm font-bold uppercase tracking-wider text-app">
              Build a roadmap
            </h2>
            <form onSubmit={handleGenerate} className="mt-4 space-y-3">
              <textarea
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Become a backend engineer at a fintech company"
                className="block w-full rounded-xl border border-input-border bg-transparent p-3 text-sm text-app outline-none focus:border-primary"
              />

              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setGoal(p)}
                    className="rounded-full border border-surface-border px-2.5 py-1 text-[11px] font-medium text-app-muted transition hover:border-primary hover:text-app"
                  >
                    {p}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-app-muted">
                <input
                  type="checkbox"
                  checked={useResume}
                  onChange={(e) => setUseResume(e.target.checked)}
                  className="h-4 w-4 rounded border-input-border"
                />
                Personalise using my saved resume
              </label>

              <button
                type="submit"
                disabled={generating}
                className="w-full rounded-xl bg-app-gradient py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
              >
                {generating ? 'Designing your path…' : 'Generate roadmap'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
            <h2 className="border-b border-surface-border pb-2 text-sm font-bold uppercase tracking-wider text-app">
              Saved roadmaps
            </h2>
            {loading ? (
              <p className="mt-3 text-xs text-app-muted">Loading…</p>
            ) : roadmaps.length === 0 ? (
              <p className="mt-3 text-xs italic text-app-muted">Nothing saved yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {roadmaps.map((r) => (
                  <div
                    key={r._id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition ${
                      active?._id === r._id
                        ? 'border-primary bg-[color:rgba(var(--primary-rgb),0.08)]'
                        : 'border-surface-border bg-default-bg'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActive(r)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-semibold text-app">{r.goal}</p>
                      <p className="text-[10px] text-app-muted">{progressOf(r)}% complete</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r._id)}
                      className="shrink-0 rounded p-1 text-rose-500 transition hover:bg-rose-500/10"
                      title="Delete roadmap"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {!active ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-surface-border bg-app-surface p-10 text-center">
              <h3 className="text-sm font-semibold text-app">No roadmap selected</h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-app-muted">
                Describe your target role on the left to generate a staged learning path.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-app">{active.goal}</h2>
                    {active.summary && (
                      <p className="mt-1 text-sm leading-relaxed text-app-muted">
                        {active.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {active.personalised && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Tailored to your resume
                      </span>
                    )}
                    <ProviderBadge provider={active.provider} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-medium text-app-muted">
                    <span>Progress</span>
                    <span>{progressOf(active)}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-default-bg">
                    <div
                      className="h-full rounded-full bg-app-gradient transition-all duration-300"
                      style={{ width: `${progressOf(active)}%` }}
                    />
                  </div>
                </div>
              </div>

              {(active.stages || []).map((stage, si) => (
                <div
                  key={stage.id}
                  className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm"
                >
                  <div className="flex items-baseline gap-3 border-b border-surface-border pb-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-app-gradient text-xs font-bold text-white">
                      {si + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-app">{stage.title}</h3>
                      {stage.description && (
                        <p className="mt-0.5 text-xs text-app-muted">{stage.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {(stage.steps || []).map((step) => (
                      <div
                        key={step.id}
                        className={`rounded-xl border p-3 transition ${
                          step.completed
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-surface-border bg-default-bg'
                        }`}
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(step.completed)}
                            onChange={(e) => toggleStep(step.id, e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input-border"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={`text-sm font-semibold ${
                                  step.completed
                                    ? 'text-app-muted line-through'
                                    : 'text-app'
                                }`}
                              >
                                {step.title}
                              </p>
                              {step.alreadyStrong && (
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                  You already know this
                                </span>
                              )}
                              <span className="text-[10px] text-app-muted">
                                ~{step.estimatedWeeks}w
                              </span>
                            </div>
                            {step.summary && (
                              <p className="mt-1 text-xs leading-relaxed text-app-muted">
                                {step.summary}
                              </p>
                            )}
                            {step.topics?.length > 0 && (
                              <div className="mt-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-app-muted">
                                  Topics — tap any for a deep dive
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {step.topics.map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      // Inside a <label>; without this the click also toggles the checkbox.
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setOpenTopic({ topic: t, stepTitle: step.title });
                                      }}
                                      className="rounded border border-surface-border px-1.5 py-0.5 text-[10px] text-app-muted transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                                    >
                                      {t}
                                      {topicCache[t] ? ' ✓' : ''}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {step.approach && (
                              <div className="mt-2 rounded-lg border border-primary/15 bg-primary/5 p-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                  How to practice this
                                </p>
                                <p className="mt-0.5 text-xs leading-relaxed text-app">{step.approach}</p>
                              </div>
                            )}
                            {step.resources?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {step.resources.map((r) => (
                                  <a
                                    key={r.label}
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex items-center gap-1 rounded-full border border-surface-border px-2 py-1 text-[10px] font-medium text-primary hover:border-primary hover:underline"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                    </svg>
                                    {r.label}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <RoadmapChat roadmapId={active._id} goal={active.goal} />
            </div>
          )}
        </div>
      </div>

      {openTopic && active && (
        <TopicDetailPanel
          roadmapId={active._id}
          topic={openTopic.topic}
          stepTitle={openTopic.stepTitle}
          cached={topicCache[openTopic.topic]}
          onCache={cacheTopic}
          onClose={() => setOpenTopic(null)}
        />
      )}
    </div>
  );
}
