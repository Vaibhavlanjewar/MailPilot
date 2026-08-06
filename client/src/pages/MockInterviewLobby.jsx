import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

/** `datetime-local` needs a local-time string, and toISOString() would shift it by the offset. */
function toLocalInputValue(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInputValue(d);
}

function formatWhen(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const EMPTY_FORM = { title: '', scheduledAt: '', durationMinutes: 30, inviteeEmail: '' };

export default function MockInterviewLobby() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, scheduledAt: defaultStart() });

  const loadMeetings = useCallback(async () => {
    try {
      const { data } = await api.get('/mock-interview/meetings');
      setMeetings(data.meetings || []);
    } catch {
      // Non-fatal: creating a room still works without the list.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // canJoinNow is computed server-side, so it goes stale as the start time
  // approaches — refresh while the page is open so the button turns on by itself.
  useEffect(() => {
    const timer = setInterval(loadMeetings, 60_000);
    return () => clearInterval(timer);
  }, [loadMeetings]);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createRoom() {
    setCreating(true);
    try {
      const { data } = await api.post('/mock-interview/rooms');
      navigate(`/app/mock-interview/${data.room.code}`);
    } catch (err) {
      toast.error(err.message || 'Could not create a room.');
    } finally {
      setCreating(false);
    }
  }

  async function scheduleMeeting(e) {
    e.preventDefault();
    setScheduling(true);
    try {
      const { data } = await api.post('/mock-interview/meetings', {
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        inviteeEmail: form.inviteeEmail.trim(),
      });

      if (form.inviteeEmail.trim() && !data.inviteSent) {
        toast.warn('Meeting scheduled, but the invite email could not be sent. Share the link instead.');
      } else if (data.inviteSent) {
        toast.success('Meeting scheduled and invite sent.');
      } else {
        toast.success('Meeting scheduled. Share the link to invite someone.');
      }

      setForm({ ...EMPTY_FORM, scheduledAt: defaultStart() });
      setShowForm(false);
      loadMeetings();
    } catch (err) {
      toast.error(err.message || 'Could not schedule the meeting.');
    } finally {
      setScheduling(false);
    }
  }

  async function cancelMeeting(code) {
    try {
      await api.patch(`/mock-interview/meetings/${code}/cancel`);
      toast.success('Meeting cancelled.');
      loadMeetings();
    } catch (err) {
      toast.error(err.message || 'Could not cancel.');
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied.');
    } catch {
      toast.info(url);
    }
  }

  const scheduled = meetings.filter((m) => m.scheduledAt);
  const instant = meetings.filter((m) => !m.scheduledAt);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Live Practice Room</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-purple-100 md:text-base">
          Video + audio mock interviews with someone else on MailPilot. Peer-to-peer, nothing
          recorded or stored. Start one now, or schedule it for later.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={createRoom}
          disabled={creating}
          className="rounded-2xl bg-app-gradient p-5 text-left shadow-md transition hover:opacity-90 disabled:opacity-50"
        >
          <p className="text-sm font-semibold text-white">
            {creating ? 'Creating…' : 'Start now'}
          </p>
          <p className="mt-1 text-xs text-white/80">Opens a room immediately and gives you a link to share.</p>
        </button>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-2xl border border-surface-border bg-app-surface p-5 text-left shadow-sm transition hover:border-primary"
        >
          <p className="text-sm font-semibold text-app">Schedule for later</p>
          <p className="mt-1 text-xs text-app-muted">Pick a time and optionally email an invite with a calendar event.</p>
        </button>
      </div>

      {showForm && (
        <form onSubmit={scheduleMeeting} className="space-y-4 rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">New meeting</h2>

          <label className="block">
            <span className="text-xs font-medium text-app-muted">What is it about?</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Backend round practice"
              className="mt-1 w-full rounded-xl border border-input-border bg-default-bg px-3 py-2 text-sm text-app"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-app-muted">When</span>
              <input
                type="datetime-local"
                required
                value={form.scheduledAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => update('scheduledAt', e.target.value)}
                className="mt-1 w-full rounded-xl border border-input-border bg-default-bg px-3 py-2 text-sm text-app"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-app-muted">How long</span>
              <select
                value={form.durationMinutes}
                onChange={(e) => update('durationMinutes', e.target.value)}
                className="mt-1 w-full rounded-xl border border-input-border bg-default-bg px-3 py-2 text-sm text-app"
              >
                {[15, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-app-muted">Invite by email (optional)</span>
            <input
              type="email"
              value={form.inviteeEmail}
              onChange={(e) => update('inviteeEmail', e.target.value)}
              placeholder="them@example.com"
              className="mt-1 w-full rounded-xl border border-input-border bg-default-bg px-3 py-2 text-sm text-app"
            />
            <span className="mt-1 block text-[11px] text-app-muted">
              Sends a calendar invite from your connected Gmail. Leave blank to just share the link yourself.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={scheduling}
              className="rounded-xl bg-app-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
            >
              {scheduling ? 'Scheduling…' : 'Schedule meeting'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-surface-border px-5 py-2.5 text-sm font-medium text-app-muted transition hover:text-app"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Upcoming</h2>
        {loading ? (
          <p className="mt-3 text-xs text-app-muted">Loading…</p>
        ) : scheduled.length === 0 ? (
          <p className="mt-3 text-xs italic text-app-muted">Nothing scheduled yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {scheduled.map((m) => (
              <div key={m.code} className="rounded-xl border border-surface-border bg-default-bg p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-app">{m.title}</p>
                    <p className="text-xs text-app-muted">
                      {formatWhen(m.scheduledAt)} · {m.durationMinutes} min
                      {m.inviteeEmail ? ` · with ${m.inviteeEmail}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                    {m.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate(`/app/mock-interview/${m.code}`)}
                    disabled={!m.canJoinNow}
                    title={m.canJoinNow ? '' : `Opens ${formatWhen(m.joinOpensAt)}`}
                    className="rounded-lg bg-app-gradient px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {m.canJoinNow ? 'Join' : `Opens ${formatWhen(m.joinOpensAt)}`}
                  </button>
                  <button
                    onClick={() => copyLink(m.joinUrl)}
                    className="rounded-lg border border-surface-border px-4 py-1.5 text-xs font-medium text-app-muted transition hover:text-app"
                  >
                    Copy link
                  </button>
                  {m.isOwner && (
                    <button
                      onClick={() => cancelMeeting(m.code)}
                      className="rounded-lg border border-surface-border px-4 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {instant.length > 0 && (
        <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Open rooms</h2>
          <div className="mt-3 space-y-2">
            {instant.map((r) => (
              <button
                key={r.code}
                onClick={() => navigate(`/app/mock-interview/${r.code}`)}
                className="flex w-full items-center justify-between rounded-xl border border-surface-border bg-default-bg p-3 text-left transition hover:border-primary"
              >
                <p className="font-mono text-xs text-app">{r.code}</p>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                  {r.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-surface-border bg-app-surface p-3 text-xs text-app-muted">
        Media flows directly between the two browsers. If a direct path is blocked, a relay server
        carries it instead, so strict office and campus networks still work.
      </div>
    </div>
  );
}
