import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import { api } from '../../services/api';

export default function Navbar({ onMenuClick, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasGmailRefreshToken, setHasGmailRefreshToken] = useState(false);
  const [gmailActionLoading, setGmailActionLoading] = useState(false);
  const ref = useRef(null);

  const initials = useMemo(() => {
    const n = user?.name?.trim() || user?.email || '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return n.slice(0, 2).toUpperCase();
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    let cancelled = false;
    async function loadGmailStatus() {
      try {
        const { data } = await api.get('/users/me/settings');
        if (!cancelled) {
          setHasGmailRefreshToken(Boolean(data?.hasGmailRefreshToken));
        }
      } catch {
        if (!cancelled) {
          setHasGmailRefreshToken(false);
        }
      }
    }

    loadGmailStatus();
    return () => {
      cancelled = true;
    };
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/');
  }

  function goToSettingsSection(section) {
    setMenuOpen(false);
    navigate(`/app/settings?section=${section}`);
  }

  async function handleGmailAction() {
    setGmailActionLoading(true);
    try {
      if (hasGmailRefreshToken) {
        await api.patch('/users/me/settings', { gmailRefreshToken: '' });
        setHasGmailRefreshToken(false);
      } else {
        const { data } = await api.get('/users/me/gmail/connect-url');
        if (!data?.url) {
          throw new Error('Could not get Gmail connect URL.');
        }
        setMenuOpen(false);
        window.location.assign(data.url);
        return;
      }
    } finally {
      setGmailActionLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-app bg-app-surface/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-app text-app-muted hover:bg-app-muted lg:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-app">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-xl border border-app bg-app-surface py-1.5 pl-2 pr-2.5 shadow-app-soft',
              menuOpen && 'ring-2 ring-app-focus border-[color:var(--primary)]'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-gradient text-xs font-semibold text-white shadow-app-soft">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-app">
                {user?.name?.trim() || 'Account'}
              </p>
              <p className="text-[11px] text-app-muted">
                {user?.email || ''}
              </p>
            </div>
            <ChevronIcon className="hidden h-4 w-4 text-app-muted sm:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-2xl border border-app bg-app-surface py-1 shadow-app-elevated">
              <button
                type="button"
                onClick={handleGmailAction}
                disabled={gmailActionLoading}
                className="flex w-full px-4 py-2.5 text-left text-sm text-app hover:bg-app-muted"
              >
                <span
                  className={cn(
                    'mr-2 mt-[5px] inline-block h-2 w-2 shrink-0 rounded-full',
                    hasGmailRefreshToken ? 'bg-emerald-500' : 'bg-rose-500'
                  )}
                  aria-hidden="true"
                />
                <span>
                  {gmailActionLoading
                    ? 'Please wait...'
                    : hasGmailRefreshToken
                      ? 'Gmail connected'
                      : 'Connect with Gmail'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToSettingsSection('password')}
                className="flex w-full px-4 py-2.5 text-left text-sm text-app hover:bg-app-muted"
              >
                Change password
              </button>
              <hr className="my-1 border-app" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full px-4 py-2.5 text-left text-sm font-medium text-[var(--primary)] hover:bg-[color:rgba(var(--primary-rgb),0.12)]"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

