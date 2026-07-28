import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { currentSession, onAuthChange, rememberDevice, sessionAccount, signOut } from '../lib/auth';
import { isCloudConfigured } from '../lib/supabase';
import type { Account } from '../lib/auth';

export interface AuthApi {
  /** False until we know whether a stored session exists. */
  ready: boolean;
  account: Account | null;
  /** True when no sign-in is possible or needed (device-only mode). */
  open: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthApi {
  const cloud = isCloudConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloud);

  useEffect(() => {
    if (!cloud) return;
    let alive = true;

    currentSession()
      .then((found) => {
        if (!alive) return;
        setSession(found);
      })
      .catch((err) => console.error('Could not read the stored session', err))
      .finally(() => {
        if (alive) setReady(true);
      });

    // Fires on sign-in, sign-out, and every silent token refresh.
    return onAuthChange((next) => {
      if (!alive) return;
      setSession(next);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Touch the device record whenever a session appears, so "last seen" is real.
  useEffect(() => {
    if (session) void rememberDevice(session);
  }, [session]);

  return {
    ready,
    account: sessionAccount(session),
    open: !cloud,
    signOut: useCallback(async () => {
      await signOut();
      setSession(null);
    }, []),
  };
}
