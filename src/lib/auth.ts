import type { Session } from '@supabase/supabase-js';
import { getSupabase, isCloudConfigured } from './supabase';

export interface Account {
  id: string;
  username: string;
}

export interface Device {
  id: string;
  label: string;
  lastSeen: string;
  /** True for the browser you're reading this in. */
  current: boolean;
}

/**
 * Accounts are named, not emailed. Supabase Auth wants an address, so each
 * username maps to a fixed one — the domain is never sent anything.
 */
const ACCOUNT_DOMAIN = 'lebanon-adventure.app';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@${ACCOUNT_DOMAIN}`;
}

export function emailToUsername(email: string | undefined): string {
  return email?.split('@')[0] ?? '';
}

/** The display name as it was typed at sign-up, when we have it. */
function accountFrom(session: Session): Account {
  const meta = session.user.user_metadata as { username?: string } | null;
  return {
    id: session.user.id,
    username: meta?.username || emailToUsername(session.user.email),
  };
}

/* --------------------------------------------------------------- device id */

const DEVICE_KEY = 'lebanon-adventure.device';

/** A stable id for this browser, so a device is remembered across sessions. */
export function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Something recognisable in a device list: "iPhone · Safari". */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const platform = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Device';
  const browser = /EdgA?\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  return `${platform} · ${browser}`;
}

/* ------------------------------------------------------------------- auth */

export async function currentSession(): Promise<Session | null> {
  if (!isCloudConfigured()) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

export function sessionAccount(session: Session | null): Account | null {
  return session ? accountFrom(session) : null;
}

export function onAuthChange(handler: (session: Session | null) => void): () => void {
  if (!isCloudConfigured()) return () => undefined;
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(username: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    // Supabase says "Invalid login credentials" for both a wrong name and a
    // wrong password, which is the right thing to tell people too.
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('That username and password don’t match an account.');
    }
    if (/email not confirmed/i.test(error.message)) {
      throw new Error('That account still needs confirming in Supabase (Auto Confirm User).');
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  // Drop this browser from the account's device list on the way out.
  try {
    await getSupabase().from('devices').delete().eq('id', deviceId());
  } catch (err) {
    console.warn('Could not remove this device', err);
  }
  await getSupabase().auth.signOut();
}

/* ---------------------------------------------------------------- devices */

/**
 * Record this browser against the account. Signing in once is enough: the
 * session is persisted and refreshed, so the device stays trusted until it is
 * signed out or forgotten from another device.
 */
export async function rememberDevice(session: Session): Promise<void> {
  const { error } = await getSupabase().from('devices').upsert(
    {
      id: deviceId(),
      user_id: session.user.id,
      label: deviceLabel(),
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) console.warn('Could not record this device', error);
}

export async function listDevices(): Promise<Device[]> {
  const { data, error } = await getSupabase()
    .from('devices')
    .select('id,label,last_seen')
    .order('last_seen', { ascending: false });
  if (error) throw error;
  const here = deviceId();
  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: (row.label as string) || 'Device',
    lastSeen: row.last_seen as string,
    current: row.id === here,
  }));
}

/** Revoke a device. Signing out elsewhere still needs that device to reload. */
export async function forgetDevice(id: string): Promise<void> {
  const { error } = await getSupabase().from('devices').delete().eq('id', id);
  if (error) throw error;
}
