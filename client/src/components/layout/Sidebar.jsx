import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { LIVE_PRACTICE_ROOM_ENABLED } from '../../config/features';
import FeedbackModal from '../FeedbackModal';

/** Grouped by job-to-be-done: sending outreach vs. preparing for roles. */
const navSections = [
  /*
   * Daily actions first, results after them, and the configure-once items moved
   * out to their own group — they were previously interleaved, which put
   * setup screens above the campaign flow people actually come here for.
   */
  {
    heading: 'Outreach',
    items: [
      { to: '/app', label: 'Dashboard', end: true, icon: LayoutIcon },
      { to: '/app/campaigns', label: 'Campaigns', icon: MegaphoneIcon },
      { to: '/app/contacts', label: 'Recipients', icon: UsersIcon },
      { to: '/app/templates', label: 'Email Templates', icon: DocumentIcon },
      { to: '/app/email-tracking', label: 'Delivery & Opens', icon: TrackingIcon },
      { to: '/app/analytics', label: 'Analytics', icon: ChartIcon },
    ],
  },
  /*
   * Ordered as the journey actually runs — work out the target, close the gaps,
   * rehearse, then apply — rather than by when each feature happened to be
   * built. Support tools that get used on and off sit at the end so the main
   * path stays on top.
   */
  {
    heading: 'Prepare',
    items: [
      { to: '/app/career-fit', label: 'Career Fit', icon: CompassIcon },
      { to: '/app/roadmap', label: 'Learning Roadmap', icon: RoadmapIcon },
      { to: '/app/interview-prep', label: 'Interview Prep', icon: AcademicCapIcon },
      { to: '/app/mock-interview', label: 'Live Practice Room', icon: VideoIcon, soon: !LIVE_PRACTICE_ROOM_ENABLED },
    ],
  },
  {
    heading: 'Apply & connect',
    items: [
      { to: '/app/jobs', label: 'Job Board', icon: BriefcaseIcon },
      { to: '/app/resume-chat', label: 'Ask My Resume', icon: ChatQuestionIcon },
      { to: '/app/community', label: 'Community', icon: ChatBubbleIcon },
      { to: '/app/mind-games', label: 'Mind Games', icon: PuzzleIcon },
    ],
  },
];

/** Configure once, then rarely revisit — but both gate real functionality. */
const setupSection = {
  heading: 'Setup',
  items: [
    { to: '/app/resume', label: 'My Resume', icon: DocumentTextIcon },
    { to: '/app/settings?section=gmail', label: 'Email Sending Setup', icon: CogIcon },
  ],
};

const accountSection = {
  heading: 'Account',
  items: [
    { to: '/app/settings', label: 'Settings', icon: CogIcon },
    { to: '/app/how-to-use', label: 'How To Use', icon: GuideIcon },
  ],
};

const recruiterSection = {
  heading: 'Recruiter',
  items: [
    { to: '/app/post-job', label: 'Post a Job', icon: DocumentPlusIcon },
    { to: '/app/my-postings', label: 'My Postings', icon: BriefcaseIcon },
  ],
};

export default function Sidebar({ open, onClose }) {
  const { isRecruiter } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const sections = isRecruiter
    ? [...navSections, recruiterSection, setupSection, accountSection]
    : [...navSections, setupSection, accountSection];

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-[color:rgba(var(--primary-rgb),0.22)] backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-app bg-app-surface shadow-elevated transition-transform lg:static lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center border-b border-surface-border px-5">
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-gradient text-sm font-bold text-white shadow-app-soft">
              M
            </div>
            <p className="text-sm font-semibold text-app">MailPilot</p>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {sections.map((section) => (
            <div key={section.heading} className="mb-4 space-y-0.5">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-app-muted/70">
                {section.heading}
              </p>
              {section.items.map((item) =>
                item.soon ? (
                  <div
                    key={item.to}
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-app-muted/50"
                  >
                    <item.icon className="h-5 w-5 shrink-0 opacity-50" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded-full bg-app-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-app-muted">
                      Soon
                    </span>
                  </div>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-[color:rgba(var(--primary-rgb),0.12)] text-[var(--primary)]'
                          : 'text-app-muted hover:bg-app-muted hover:text-app'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0 opacity-80" />
                    {item.label}
                  </NavLink>
                )
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-app-muted transition-all duration-200 hover:bg-app-muted hover:text-app"
          >
            <FeedbackIcon className="h-5 w-5 shrink-0 opacity-80" />
            Feedback
          </button>
        </nav>
        <div className="border-t border-app p-4">
          <Link
            to="/app/pricing"
            onClick={onClose}
            className="block rounded-xl bg-app-muted px-3 py-2.5 transition-colors hover:bg-[color:rgba(var(--primary-rgb),0.12)]"
          >
            <p className="text-xs font-semibold text-app">Default pack</p>
            <p className="mt-0.5 text-xs text-app-muted">
              Free (dev in process) for 2 weeks
            </p>
            <p className="mt-1 text-[11px] font-medium text-[var(--primary)]">Open pricing</p>
          </Link>
        </div>
      </aside>
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}

function LayoutIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V18A2.25 2.25 0 008.25 20.25H15a2.25 2.25 0 002.25-2.25V13.5M10.5 6H15a2.25 2.25 0 012.25 2.25V10.5" />
    </svg>
  );
}

function MegaphoneIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h10.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 8l4 4-4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.5h4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12h4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 15.5h4.5" />
    </svg>
  );
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <rect x="3" y="5" width="18" height="14" rx="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7l7.5 5.5L19.5 7" />
    </svg>
  );
}

function DocumentIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  );
}

function TrackingIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l3.75 2.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CogIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function GuideIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 01.75-.75h6a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75h-6A.75.75 0 0112 17.25V6.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 00-.75-.75h-6a.75.75 0 00-.75.75v10.5a.75.75 0 00.75.75h6a.75.75 0 00.75-.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9h1.5m-1.5 3h1.5m4.5-3h1.5m-1.5 3h1.5" />
    </svg>
  );
}

function FeedbackIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-9.75 8.25L5.1 15.9a2.25 2.25 0 011.591-.659h10.56A2.25 2.25 0 0019.5 13V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5A2.25 2.25 0 006.75 19.5z" />
    </svg>
  );
}

function VideoIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function CompassIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}

function RoadmapIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4.5v4.5m0 0a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5zm0 4.5v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 19.5V15m0 0a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zm0-4.5v-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75h6M9 17.25h6" />
    </svg>
  );
}

function SparklesIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904zM18 5.25L17.25 9l-.75-3.75L12.75 4.5l3.75-.75L17.25 0l.75 3.75 3.75.75-3.75.75zM20.25 15.75l-.563 2.813-2.813.563 2.813.563.563 2.813.563-2.813 2.813-.563-2.813-.563-.563-2.813z" />
    </svg>
  );
}

function BriefcaseIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .621-.504 1.125-1.125 1.125H4.875A1.125 1.125 0 013.75 18.4V14.15m16.5 0a9.003 9.003 0 00-16.5 0m16.5 0L19.5 11.25H4.5L3.75 14.15M15 8.25V5.25c0-.621-.504-1.125-1.125-1.125h-3.75c-.621 0-1.125.504-1.125 1.125v3M3.375 7.5h17.25c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 10.125v-1.5c0-.621.504-1.125 1.125-1.125z" />
    </svg>
  );
}

function AcademicCapIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.9c4.956-1.936 8.23-6.662 8.23-11.89m-16.46 0A12.012 12.012 0 0112 3c1.933 0 3.702.458 5.27 1.258m-13.01 5.89h10.56" />
    </svg>
  );
}

function DocumentPlusIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PuzzleIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.007-1.875 2.25-1.875s2.25.84 2.25 1.875c0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.369 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  );
}

function ChatBubbleIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-9.75 8.25L5.1 15.9a2.25 2.25 0 011.591-.659h10.56a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0017.25 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function DocumentTextIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ChatQuestionIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 18a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 13.517 3 11.856 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}
