import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Whatever call is currently running, published by the practice-room screen so
 * a floating bubble can be drawn over the rest of the app once that screen is
 * no longer the visible one.
 *
 * The call itself deliberately stays owned by the room screen — the drawer
 * navigator keeps screens mounted after their first visit, so navigating
 * elsewhere doesn't tear the peer connection down. This context only carries
 * what the bubble needs to render and the handlers it needs to call, which
 * keeps the signalling logic in one place instead of split across a provider.
 *
 * `renderThumbnail` is a render prop rather than a MediaStream so this file
 * never imports react-native-webrtc — that module throws at import time when
 * its native side isn't linked, and this context is loaded app-wide.
 */
export type ActiveCall = {
  code: string;
  /** Short status line for the bubble, e.g. "Live" or "Reconnecting…". */
  label: string;
  /** True while the room screen is the visible screen — bubble hides then. */
  focused: boolean;
  renderThumbnail?: () => React.ReactNode;
  onReturn: () => void;
  onLeave: () => void;
};

type ContextValue = {
  call: ActiveCall | null;
  setCall: (next: ActiveCall | null) => void;
  clearCall: (code: string) => void;
};

const ActiveCallContext = createContext<ContextValue | null>(null);

export function ActiveCallProvider({ children }: { children: React.ReactNode }) {
  const [call, setCall] = useState<ActiveCall | null>(null);

  /**
   * Scoped by code so a room tearing down late can't wipe the entry a newer
   * room already published (leave one room, immediately join another).
   */
  const clearCall = useCallback((code: string) => {
    setCall((prev) => (prev && prev.code !== code ? prev : null));
  }, []);

  const value = useMemo(() => ({ call, setCall, clearCall }), [call, clearCall]);

  return <ActiveCallContext.Provider value={value}>{children}</ActiveCallContext.Provider>;
}

export function useActiveCall() {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) throw new Error('useActiveCall must be used within ActiveCallProvider');
  return ctx;
}
