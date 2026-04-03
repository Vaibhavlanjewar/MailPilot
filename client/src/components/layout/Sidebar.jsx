import { Link, NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';

const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSff_YjvIVpgc6umn0zl3mihp7dvTYztqREbj_HElb70wCpXaw/viewform?usp=publish-editor';

const nav = [
  { to: '/app', label: 'Dashboard', end: true, icon: LayoutIcon },
  { to: '/app/campaigns', label: 'Campaigns', icon: MegaphoneIcon },
  { to: '/app/contacts', label: 'Contacts', icon: UsersIcon },
  { to: '/app/templates', label: 'Templates', icon: DocumentIcon },
  { to: '/app/analytics', label: 'Analytics', icon: ChartIcon },
  { to: '/app/settings', label: 'Settings', icon: CogIcon },
  { to: '/app/how-to-use', label: 'How To Use', icon: GuideIcon },
];

export default function Sidebar({ open, onClose }) {
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
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 scrollbar-thin">
          {nav.map((item) => (
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
          ))}
          <a
            href={googleFormUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-app-muted transition-all duration-200 hover:bg-app-muted hover:text-app"
          >
            <FeedbackIcon className="h-5 w-5 shrink-0 opacity-80" />
            Feedback
          </a>
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783m0 0a24.24 24.24 0 010 9.75m-9.75-9.75h9.75" />
    </svg>
  );
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.813-3.714M6 12a3 3 0 11-6 0 3 3 0 016 0zm12 4.5a3 3 0 11-6 0 3 3 0 016 0z" />
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
