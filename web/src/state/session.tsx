import type { Preferences } from '@shared/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export interface SessionUser {
  id: string;
  email: string;
  isDemo: boolean;
}

interface SessionPayload {
  user: SessionUser | null;
  preferences?: Preferences;
}

interface SessionState {
  status: 'loading' | 'ready';
  user: SessionUser | null;
  preferences: Preferences | null;
  setSession: (p: SessionPayload) => void;
  updatePreferences: (fn: (p: Preferences) => Preferences) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

function applyAccessibility(p: Preferences | null) {
  const root = document.documentElement;
  const a = p?.accessibility;
  root.dataset.text = a?.textSize ?? 'default';
  root.dataset.contrast = a?.highContrast ? 'high' : 'default';
  root.dataset.motion = a?.reducedMotion ? 'reduced' : 'default';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const latest = useRef<Preferences | null>(null);

  const setSession = useCallback((p: SessionPayload) => {
    setUser(p.user);
    setPreferences(p.preferences ?? null);
    latest.current = p.preferences ?? null;
  }, []);

  useEffect(() => {
    api<SessionPayload>('/auth/session')
      .then(setSession)
      .catch(() => setSession({ user: null }))
      .finally(() => setStatus('ready'));
  }, [setSession]);

  useEffect(() => applyAccessibility(preferences), [preferences]);

  const updatePreferences = useCallback(async (fn: (p: Preferences) => Preferences) => {
    const prev = latest.current;
    if (!prev) return;
    const next = fn(prev);
    latest.current = next;
    setPreferences(next);
    try {
      const saved = await api<Preferences>('/me/preferences', { method: 'PUT', body: next });
      if (latest.current === next) {
        latest.current = saved;
        setPreferences(saved);
      }
    } catch (err) {
      latest.current = prev;
      setPreferences(prev);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setSession({ user: null });
  }, [setSession]);

  const value = useMemo(
    () => ({ status, user, preferences, setSession, updatePreferences, signOut }),
    [status, user, preferences, setSession, updatePreferences, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside provider');
  return ctx;
}
