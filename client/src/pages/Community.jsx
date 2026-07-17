import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const INITIAL_THREADS = [
  {
    id: 'thread-1',
    title: 'Tips for negotiating a Senior Frontend Architect offer at Stripe',
    category: 'Salary',
    authorName: 'Rohan Sharma',
    authorAvatar: 'RS',
    content: 'Just went through the final negotiation round at Stripe. The base salary ranges are quite flexible, but they heavily favor stock options (RSUs) over sign-on cash bonuses. Make sure key frameworks are listed in your resume profile to leverage matching tech levels.',
    likes: 24,
    likedByUser: false,
    comments: [
      { id: 'c-1', author: 'Deepika K.', content: 'Did you attempt to counter-offer with options from other remote platforms?', date: '1 day ago' },
      { id: 'c-2', author: 'Rohan Sharma', content: 'Yes, leveraged a counter-proposal from Meta which helped increase base compensation.', date: '12 hours ago' }
    ],
    datePosted: '2 days ago'
  },
  {
    id: 'thread-2',
    title: 'Referral slots open for Google Cloud Platform Team (Bengaluru)',
    category: 'Referrals',
    authorName: 'Amit Sharma',
    authorAvatar: 'AS',
    content: 'We are hiring Backend Developers (L4/L5) for the Cloud API team in BLR. Tech stack is Go, Java, and gRPC. Drop your resume extracted text in the thread or mail me directly if you have at least 3 years backend engineering background!',
    likes: 42,
    likedByUser: false,
    comments: [
      { id: 'c-3', author: 'Nisha Gupta', content: 'Super interested! Will upload my parsed resume in a few.', date: '3 hours ago' }
    ],
    datePosted: '1 day ago'
  },
  {
    id: 'thread-3',
    title: 'Ollama local inference latency vs Gemini Web API speed test',
    category: 'Tech Stack',
    authorName: 'Vikas Patel',
    authorAvatar: 'VP',
    content: 'Ran benchmark tests for recruitment outreach template generation. Gemini 1.5 Flash takes around 800ms-1.2s via cloud fetch. Local Ollama (qwen2.5-coder:0.5b) runs at 2.4s average on an Apple Silicon desktop setup. In-memory fallback is fastest but static.',
    likes: 18,
    likedByUser: false,
    comments: [],
    datePosted: '5 hours ago'
  },
  {
    id: 'thread-4',
    title: 'Meta System Design rounds study plan - What actually helped',
    category: 'Interview Tips',
    authorName: 'Elena R.',
    authorAvatar: 'ER',
    content: 'Focus heavily on distributed consensus layers, data consistency boundaries (eventual vs strong), and caching hierarchies (Redis/Memcached). Designing scaleable checkout widgets or general notification feeds is a frequent mock exercise.',
    likes: 35,
    likedByUser: false,
    comments: [
      { id: 'c-4', author: 'Jayesh M.', content: 'Did you use interactive whiteboards or standard diagram sheets?', date: '2 days ago' }
    ],
    datePosted: '3 days ago'
  }
];

export default function Community() {
  const [threads, setJobs] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newContent, setNewContent] = useState('');
  
  // Custom Filters
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Comment Box input dictionary keyed by Thread ID
  const [commentInputs, setCommentInputs] = useState({});

  // Moderation status feedback banner
  const [moderationWarning, setModerationWarning] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('mailpilot_community_threads');
    if (saved) {
      try {
        setJobs(JSON.parse(saved));
      } catch (e) {
        setJobs(INITIAL_THREADS);
      }
    } else {
      setJobs(INITIAL_THREADS);
    }
  }, []);

  const checkContent = (text) => {
    if (!text) return { allowed: true };
    
    // Toxic, abusive, profiling, scam or threatening keywords
    const TOXIC_TOKENS = [
      'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'idiot', 'stupid', 'dumbass', 
      'scam', 'crypto rich', 'make fast money', 'buy bitcoin', 'hack account', 'kill yourself', 'threaten', 
      'harass', 'hate speech'
    ];

    const lower = text.toLowerCase();
    
    for (const token of TOXIC_TOKENS) {
      if (lower.includes(token)) {
        return {
          allowed: false,
          reason: `Potential toxic, abusive, or scam word detected: "${token}"`,
          guideline: "MailPilot community requires disciplined, respectful, and professional coding behavior. Abusive content or suspicious promotions are blocked."
        };
      }
    }

    // Pattern repetition blocker (spam)
    if (/(.)\1{7,}/.test(lower)) {
      return {
        allowed: false,
        reason: "Suspicious spam pattern detected (excessive character repetition).",
        guideline: "Please keep all headers and replies clean and formatted properly."
      };
    }

    return { allowed: true };
  };

  const saveThreadsToStore = (newList) => {
    setJobs(newList);
    localStorage.setItem('mailpilot_community_threads', JSON.stringify(newList));
  };

  const handleCreateThread = (e) => {
    e.preventDefault();
    setModerationWarning(null);

    const titleCheck = checkContent(newTitle);
    const contentCheck = checkContent(newContent);

    if (!titleCheck.allowed) {
      setModerationWarning(titleCheck);
      toast.error('Submission Blocked: Abusive or spam words detected in title.');
      return;
    }

    if (!contentCheck.allowed) {
      setModerationWarning(contentCheck);
      toast.error('Submission Blocked: Abusive or spam words detected in details.');
      return;
    }

    if (!newTitle.trim() || !newContent.trim()) {
      toast.info('Please enter discussion header title and details body.');
      return;
    }

    const newThread = {
      id: `thread-${Math.floor(1000 + Math.random() * 9000)}`,
      title: newTitle.trim(),
      category: newCategory,
      authorName: 'You (Active Candidate)',
      authorAvatar: 'ME',
      content: newContent.trim(),
      likes: 0,
      likedByUser: false,
      comments: [],
      datePosted: 'Just now'
    };

    const updated = [newThread, ...threads];
    saveThreadsToStore(updated);
    
    // reset form
    setNewTitle('');
    setNewContent('');
    setNewCategory('General');
    toast.success('Successfully published community discussion thread!');
  };

  const handleToggleLike = (threadId) => {
    const updated = threads.map((t) => {
      if (t.id === threadId) {
        const liked = !t.likedByUser;
        return {
          ...t,
          likedByUser: liked,
          likes: liked ? t.likes + 1 : t.likes - 1
        };
      }
      return t;
    });

    saveThreadsToStore(updated);
  };

  const handlePostComment = (e, threadId) => {
    e.preventDefault();
    setModerationWarning(null);

    const commentText = commentInputs[threadId]?.trim();
    if (!commentText) return;

    const commentCheck = checkContent(commentText);
    if (!commentCheck.allowed) {
      setModerationWarning(commentCheck);
      toast.error('Reply Blocked: Abusive or spam words detected.');
      return;
    }

    const updated = threads.map((t) => {
      if (t.id === threadId) {
        return {
          ...t,
          comments: [
            ...t.comments,
            {
              id: `c-${Math.floor(1000 + Math.random() * 9000)}`,
              author: 'You (Active Candidate)',
              content: commentText,
              date: 'Just now'
            }
          ]
        };
      }
      return t;
    });

    saveThreadsToStore(updated);
    setCommentInputs({
      ...commentInputs,
      [threadId]: ''
    });
    toast.success('Reply submitted.');
  };

  const handleCommentInputChange = (threadId, value) => {
    setCommentInputs({
      ...commentInputs,
      [threadId]: value
    });
  };

  const filteredThreads = threads.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'All' || t.category.toLowerCase() === activeCategory.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', 'Salary', 'Referrals', 'Tech Stack', 'Interview Tips', 'General'];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header Panel */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Job Discussion Forum & Blog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-105 md:text-base">
          Share referrals, study guides, tech comparisons, and salary ranges. Connect with developers and hiring recruiters to build outreach leverage.
        </p>
      </div>

      {/* Moderation Safety Alert Banner */}
      {moderationWarning && (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-50 dark:bg-rose-950/20 p-5 text-rose-800 dark:text-rose-250 shadow-sm flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <svg className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="space-y-1">
              <span className="font-bold text-xs uppercase tracking-wider block">Content Blocked - Policy Violation</span>
              <p className="text-sm font-semibold">{moderationWarning.reason}</p>
              <p className="text-xs text-rose-600 dark:text-rose-350">{moderationWarning.guideline}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setModerationWarning(null)}
            className="text-rose-500 hover:text-rose-700 font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Create Thread Creator and Filters */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Tag filters list */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-app-muted">Filter Categories</h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                    activeCategory.toLowerCase() === cat.toLowerCase()
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-default-bg border-surface-border text-app-muted hover:text-app'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative pt-2">
              <svg className="absolute left-3 top-5 h-4 w-4 text-app-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" />
              </svg>
              <input
                type="text"
                className="block w-full rounded-xl border border-input-border bg-transparent py-2 pl-9 pr-3 text-xs text-app outline-none focus:border-primary"
                placeholder="Search forum topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Post/Create new thread form */}
          <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-app">Start a Discussion</h2>
            <form onSubmit={handleCreateThread} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Header Theme / Title *</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                  placeholder="e.g. AWS Devops L5 Referral tips..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Category Channel</label>
                <select
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary dark:bg-slate-900"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="Salary">Salary Negotiation</option>
                  <option value="Referrals">Referrals & Leads</option>
                  <option value="Tech Stack">Tech Stack Benchmark</option>
                  <option value="Interview Tips">Interview Tips</option>
                  <option value="General">General / Blog</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-app-muted">Post Detail Body *</label>
                <textarea
                  rows={4}
                  required
                  className="mt-1 block w-full rounded-xl border border-input-border bg-transparent p-2.5 text-xs text-app outline-none focus:border-primary"
                  placeholder="Write your advice, question, or blog updates here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-white shadow-soft transition hover:opacity-90"
              >
                Publish Discussion Thread
              </button>
            </form>
          </div>

        </div>

        {/* Right Side: Threads & replies stream */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-app-muted border-b border-surface-border pb-2">
            <span>DISCUSSIONS STREAM ({filteredThreads.length})</span>
            <span>SORT: CHRONOLOGICAL</span>
          </div>

          {filteredThreads.length === 0 ? (
            <div className="bg-app-surface border border-dashed border-slate-350 dark:border-slate-800 p-12 text-center text-app-muted rounded-2xl">
              <svg className="mx-auto h-12 w-12 text-slate-350 dark:text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="mt-4 text-sm font-semibold text-app">No discussions match your filter criteria</h3>
              <p className="mt-1 text-xs max-w-sm mx-auto leading-relaxed">
                Clear active tag buttons or adjust the keyword query string.
              </p>
            </div>
          ) : (
            filteredThreads.map((t) => (
              <div key={t.id} className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm space-y-4 hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary border border-primary/25 flex items-center justify-center font-bold text-xs">
                      {t.authorAvatar}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-app">{t.authorName}</h4>
                      <p className="text-[10px] text-app-muted">{t.datePosted}</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/15">
                    {t.category}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-bold text-app text-sm leading-snug md:text-base">{t.title}</h3>
                  <p className="text-xs text-app leading-relaxed text-justify">{t.content}</p>
                </div>

                {/* Likes counter and Actions */}
                <div className="flex items-center gap-4 border-t border-b border-surface-border py-2 text-xs font-semibold text-app-muted">
                  <button
                    onClick={() => handleToggleLike(t.id)}
                    className={`flex items-center gap-1.5 transition ${
                      t.likedByUser ? 'text-rose-500' : 'hover:text-rose-500'
                    }`}
                  >
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                      {t.likedByUser ? (
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      ) : (
                        <path fill="none" stroke="currentColor" strokeWidth={1.5} d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      )}
                    </svg>
                    <span>{t.likes} Likes</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-9.75 8.25L5.1 15.9a2.25 2.25 0 011.591-.659h10.56a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>{t.comments.length} Reply(ies)</span>
                  </div>
                </div>

                {/* Comments list nested */}
                {t.comments.length > 0 && (
                  <div className="space-y-2 pl-4 border-l border-surface-border">
                    {t.comments.map((comment) => (
                      <div key={comment.id} className="bg-default-bg rounded-xl p-3 text-xs leading-relaxed space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-app-muted">
                          <span>{comment.author}</span>
                          <span>{comment.date}</span>
                        </div>
                        <p className="text-app">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply box */}
                <form onSubmit={(e) => handlePostComment(e, t.id)} className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 rounded-xl border border-input-border bg-transparent px-3 py-2 text-xs text-app outline-none focus:border-primary placeholder:text-[10px]"
                    placeholder="Write a public reply to this thread..."
                    value={commentInputs[t.id] || ''}
                    onChange={(e) => handleCommentInputChange(t.id, e.target.value)}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white bg-slate-900 border border-slate-700/50 hover:bg-slate-950 transition"
                  >
                    Reply
                  </button>
                </form>

              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
}
