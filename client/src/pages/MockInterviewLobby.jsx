import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function MockInterviewLobby() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/mock-interview/rooms')
      .then(({ data }) => setRooms(data.rooms || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-700 via-pink-600 to-indigo-700 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Live Practice Room</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-purple-100 md:text-base">
          Video + audio mock interviews with someone else on MailPilot. Peer-to-peer, nothing
          recorded or stored. Create a room, share the link, and start when they join.
        </p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-app-muted">
          Works on most home and mobile networks. A minority of strict corporate/campus firewalls
          may block the direct connection — if that happens, try a different network.
        </div>
        <button
          onClick={createRoom}
          disabled={creating}
          className="mt-4 w-full rounded-xl bg-app-gradient py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create a practice room'}
        </button>
      </div>

      <div className="rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-app-muted">Your recent rooms</h2>
        {loading ? (
          <p className="mt-3 text-xs text-app-muted">Loading…</p>
        ) : rooms.length === 0 ? (
          <p className="mt-3 text-xs italic text-app-muted">No rooms yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {rooms.map((r) => (
              <button
                key={r.code}
                onClick={() => navigate(`/app/mock-interview/${r.code}`)}
                className="flex w-full items-center justify-between rounded-xl border border-surface-border bg-default-bg p-3 text-left transition hover:border-primary"
              >
                <div>
                  <p className="font-mono text-xs text-app">{r.code}</p>
                  <p className="text-[10px] text-app-muted">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  r.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                }`}>
                  {r.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
