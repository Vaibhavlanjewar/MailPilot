import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../services/api';

const CATEGORIES = ['Interview Experience', 'Referrals', 'Resume Review', 'Salary', 'General'];

const TOXIC_TOKENS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'idiot', 'stupid', 'dumbass',
  'scam', 'crypto rich', 'make fast money', 'buy bitcoin', 'hack account', 'kill yourself',
  'threaten', 'harass', 'hate speech',
];

function checkContent(text) {
  if (!text) return { allowed: true };
  const lower = text.toLowerCase();
  for (const token of TOXIC_TOKENS) {
    if (lower.includes(token)) {
      return { allowed: false, reason: `Blocked word detected: "${token}"` };
    }
  }
  if (/(.)\1{7,}/.test(lower)) {
    return { allowed: false, reason: 'Suspicious spam pattern (excessive character repetition).' };
  }
  return { allowed: true };
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [warning, setWarning] = useState(null);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newBody, setNewBody] = useState('');
  const [posting, setPosting] = useState(false);

  const [editingPostId, setEditingPostId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', body: '', category: 'General' });

  const [replyInputs, setReplyInputs] = useState({});
  const [editingReply, setEditingReply] = useState(null); // { postId, replyId }
  const [editReplyText, setEditReplyText] = useState('');

  // Guards against out-of-order responses (StrictMode double-invoke, debounce +
  // network jitter) overwriting fresh state with a stale/failed older request.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const { data } = await api.get('/discussions', {
        params: {
          category: activeCategory === 'All' ? undefined : activeCategory,
          q: searchQuery.trim() || undefined,
        },
      });
      if (requestId !== requestIdRef.current) return;
      setPosts(data.posts || []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      toast.error(err.message || 'Could not load discussions.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(load, 250); // debounce search
    return () => clearTimeout(timer);
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setWarning(null);

    const titleCheck = checkContent(newTitle);
    const bodyCheck = checkContent(newBody);
    if (!titleCheck.allowed) return setWarning(titleCheck), toast.error('Title blocked by content policy.');
    if (!bodyCheck.allowed) return setWarning(bodyCheck), toast.error('Post blocked by content policy.');
    if (!newTitle.trim() || !newBody.trim()) return toast.info('Title and body are required.');

    setPosting(true);
    try {
      const { data } = await api.post('/discussions', {
        title: newTitle.trim(),
        body: newBody.trim(),
        category: newCategory,
      });
      setPosts((prev) => [{ ...data.post, upvoteCount: 0, replyCount: 0, hasUpvoted: false, isOwner: true }, ...prev]);
      setNewTitle('');
      setNewBody('');
      setNewCategory('General');
      toast.success('Posted to the community.');
    } catch (err) {
      toast.error(err.message || 'Could not publish your post.');
    } finally {
      setPosting(false);
    }
  }

  function startEdit(post) {
    setEditingPostId(post._id);
    setEditDraft({ title: post.title, body: post.body, category: post.category });
  }

  async function saveEdit(postId) {
    const titleCheck = checkContent(editDraft.title);
    const bodyCheck = checkContent(editDraft.body);
    if (!titleCheck.allowed || !bodyCheck.allowed) {
      toast.error('Edit blocked by content policy.');
      return;
    }
    try {
      const { data } = await api.patch(`/discussions/${postId}`, editDraft);
      setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, ...data.post } : p)));
      setEditingPostId(null);
      toast.success('Post updated.');
    } catch (err) {
      toast.error(err.message || 'Could not save changes.');
    }
  }

  async function deletePost(postId) {
    try {
      await api.delete(`/discussions/${postId}`);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      toast.success('Post deleted.');
    } catch (err) {
      toast.error(err.message || 'Could not delete post.');
    }
  }

  async function toggleUpvote(post) {
    setPosts((prev) =>
      prev.map((p) =>
        p._id === post._id
          ? { ...p, hasUpvoted: !p.hasUpvoted, upvoteCount: p.upvoteCount + (p.hasUpvoted ? -1 : 1) }
          : p,
      ),
    );
    try {
      await api.post(`/discussions/${post._id}/upvote`);
    } catch (err) {
      toast.error(err.message || 'Could not update like.');
      load();
    }
  }

  // Threads are kept collapsed by default; loaded lazily on expand to avoid N+1 fetches on the list view.
  const [expandedId, setExpandedId] = useState(null);
  const [expandedPost, setExpandedPost] = useState(null);

  async function toggleExpand(postId) {
    if (expandedId === postId) {
      setExpandedId(null);
      setExpandedPost(null);
      return;
    }
    setExpandedId(postId);
    try {
      const { data } = await api.get(`/discussions/${postId}`);
      setExpandedPost(data.post);
    } catch (err) {
      toast.error(err.message || 'Could not load replies.');
    }
  }

  async function postReply(postId) {
    const text = replyInputs[postId]?.trim();
    if (!text) return;
    const check = checkContent(text);
    if (!check.allowed) return toast.error('Reply blocked by content policy.');

    try {
      const { data } = await api.post(`/discussions/${postId}/replies`, { body: text });
      setExpandedPost(data.post);
      setReplyInputs((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, replyCount: p.replyCount + 1 } : p)));
    } catch (err) {
      toast.error(err.message || 'Could not post reply.');
    }
  }

  async function saveReplyEdit(postId, replyId) {
    if (!editReplyText.trim()) return;
    try {
      const { data } = await api.patch(`/discussions/${postId}/replies/${replyId}`, { body: editReplyText });
      setExpandedPost(data.post);
      setEditingReply(null);
      toast.success('Reply updated.');
    } catch (err) {
      toast.error(err.message || 'Could not save reply.');
    }
  }

  async function deleteReply(postId, replyId) {
    try {
      const { data } = await api.delete(`/discussions/${postId}/replies/${replyId}`);
      setExpandedPost(data.post);
      setPosts((prev) => prev.map((p) => (p._id === postId ? { ...p, replyCount: Math.max(0, p.replyCount - 1) } : p)));
      toast.success('Reply deleted.');
    } catch (err) {
      toast.error(err.message || 'Could not delete reply.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-cyan-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Community</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 md:text-base">
          Share referrals, interview experiences, and salary data. Posts are real and persisted —
          you can edit or delete anything you write.
        </p>
      </div>

      {warning && (
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-rose-500/25 bg-rose-50 p-5 text-rose-800 shadow-sm dark:bg-rose-950/20 dark:text-rose-200">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider">Content blocked</span>
            <p className="mt-1 text-sm font-semibold">{warning.reason}</p>
          </div>
          <button onClick={() => setWarning(null)} className="text-xs font-bold text-rose-500 hover:text-rose-700">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="space-y-3 rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-app-muted">Filter</h3>
            <div className="flex flex-wrap gap-2">
              {['All', ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    activeCategory === cat
                      ? 'border-primary bg-primary/10 font-bold text-primary'
                      : 'border-surface-border bg-default-bg text-app-muted hover:text-app'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="block w-full rounded-xl border border-input-border bg-transparent px-3 py-2 text-xs text-app outline-none focus:border-primary"
              placeholder="Search discussions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-app">Start a discussion</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                required
                className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <select
                className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary dark:bg-slate-900"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <textarea
                rows={4}
                required
                className="block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                placeholder="Write your post…"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
              <button
                type="submit"
                disabled={posting}
                className="w-full rounded-xl bg-app-gradient py-2.5 text-xs font-semibold text-white shadow-soft transition hover:opacity-90 disabled:opacity-50"
              >
                {posting ? 'Publishing…' : 'Publish'}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-surface-border pb-2 text-xs font-semibold text-app-muted">
            <span>DISCUSSIONS ({posts.length})</span>
          </div>

          {loading ? (
            <p className="text-xs text-app-muted">Loading…</p>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-border bg-app-surface p-12 text-center text-app-muted">
              <h3 className="text-sm font-semibold text-app">No discussions yet</h3>
              <p className="mt-1 text-xs">Be the first to post in this category.</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post._id} className="space-y-4 rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-xs font-bold text-primary">
                      {(post.authorName || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-app">{post.authorName || 'Member'}</h4>
                      <p className="text-[10px] text-app-muted">{timeAgo(post.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-primary/15 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {post.category}
                    </span>
                    {post.isOwner && editingPostId !== post._id && (
                      <>
                        <button onClick={() => startEdit(post)} title="Edit" className="rounded p-1 text-app-muted hover:bg-app-muted hover:text-app">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                        <button onClick={() => deletePost(post._id)} title="Delete" className="rounded p-1 text-rose-500 hover:bg-rose-500/10">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editingPostId === post._id ? (
                  <div className="space-y-2">
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                      className="block w-full rounded-xl border border-input-border bg-transparent p-2 text-sm text-app outline-none focus:border-primary"
                    />
                    <select
                      value={editDraft.category}
                      onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                      className="block w-full rounded-xl border border-input-border bg-transparent p-2 text-xs text-app outline-none focus:border-primary dark:bg-slate-900"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <textarea
                      rows={3}
                      value={editDraft.body}
                      onChange={(e) => setEditDraft((d) => ({ ...d, body: e.target.value }))}
                      className="block w-full rounded-xl border border-input-border bg-transparent p-2 text-xs text-app outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(post._id)} className="rounded-xl bg-app-gradient px-3 py-1.5 text-xs font-semibold text-white">
                        Save
                      </button>
                      <button onClick={() => setEditingPostId(null)} className="rounded-xl bg-app-muted px-3 py-1.5 text-xs font-semibold text-app">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-app md:text-base">{post.title}</h3>
                    <p className="text-xs leading-relaxed text-app">{post.body}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 border-t border-b border-surface-border py-2 text-xs font-semibold text-app-muted">
                  <button
                    onClick={() => toggleUpvote(post)}
                    className={`flex items-center gap-1.5 transition ${post.hasUpvoted ? 'text-rose-500' : 'hover:text-rose-500'}`}
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      {post.hasUpvoted ? (
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      ) : (
                        <path fill="none" stroke="currentColor" strokeWidth={1.5} d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      )}
                    </svg>
                    <span>{post.upvoteCount}</span>
                  </button>
                  <button onClick={() => toggleExpand(post._id)} className="flex items-center gap-1 hover:text-app">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-9.75 8.25L5.1 15.9a2.25 2.25 0 011.591-.659h10.56a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>{post.replyCount} {expandedId === post._id ? '(hide)' : ''}</span>
                  </button>
                </div>

                {expandedId === post._id && expandedPost && (
                  <div className="space-y-3">
                    {expandedPost.replies.length > 0 && (
                      <div className="space-y-2 border-l border-surface-border pl-4">
                        {expandedPost.replies.map((r) => (
                          <div key={r._id} className="space-y-1 rounded-xl bg-default-bg p-3 text-xs leading-relaxed">
                            <div className="flex items-center justify-between text-[10px] font-bold text-app-muted">
                              <span>{r.authorName}</span>
                              <div className="flex items-center gap-2">
                                <span>{timeAgo(r.createdAt)}</span>
                                {r.isOwner && (
                                  <>
                                    <button
                                      onClick={() => { setEditingReply({ postId: post._id, replyId: r._id }); setEditReplyText(r.body); }}
                                      className="text-primary hover:underline"
                                    >
                                      Edit
                                    </button>
                                    <button onClick={() => deleteReply(post._id, r._id)} className="text-rose-500 hover:underline">
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {editingReply?.replyId === r._id ? (
                              <div className="space-y-1">
                                <input
                                  value={editReplyText}
                                  onChange={(e) => setEditReplyText(e.target.value)}
                                  className="block w-full rounded-lg border border-input-border bg-transparent p-1.5 text-xs text-app outline-none focus:border-primary"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => saveReplyEdit(post._id, r._id)} className="text-primary hover:underline">Save</button>
                                  <button onClick={() => setEditingReply(null)} className="text-app-muted hover:underline">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-app">{r.body}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={(e) => { e.preventDefault(); postReply(post._id); }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        className="flex-1 rounded-xl border border-input-border bg-transparent px-3 py-2 text-xs text-app outline-none focus:border-primary"
                        placeholder="Write a reply…"
                        value={replyInputs[post._id] || ''}
                        onChange={(e) => setReplyInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
                      />
                      <button type="submit" className="rounded-xl bg-app-gradient px-4 py-2 text-xs font-semibold text-white">
                        Reply
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
