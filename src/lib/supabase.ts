import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RAW_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const RAW_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** Public Storage bucket holding every pin's pictures. */
export const PHOTO_BUCKET = 'pin-photos';

/**
 * Accept whatever the dashboard put on someone's clipboard: the full project
 * URL, one with a trailing slash, or just the bare project ref.
 */
function resolveUrl(raw: string): string {
  if (!raw) return '';
  const value = raw.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(value)) return value;
  // Project refs are a single run of lowercase letters, ~20 chars, no dots.
  if (/^[a-z0-9]{16,32}$/.test(value)) return `https://${value}.supabase.co`;
  if (/^[a-z0-9-]+\.supabase\.(co|in)$/i.test(value)) return `https://${value}`;
  return '';
}

export const SUPABASE_URL = resolveUrl(RAW_URL);

/** True when the key grants admin rights and must never reach a browser. */
function looksSecret(key: string): boolean {
  if (/^sb_secret_/i.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

const KEY_OK = RAW_KEY.length > 20 && !looksSecret(RAW_KEY);

export function isCloudConfigured(): boolean {
  return !!SUPABASE_URL && KEY_OK;
}

/**
 * Why the shared map isn't connected, in words worth showing a human. Empty
 * when everything is fine — and also when nothing was configured at all, since
 * running device-only is a legitimate choice for local development.
 */
export function configIssue(): string {
  if (isCloudConfigured()) return '';
  if (!RAW_URL && !RAW_KEY) return '';

  if (!RAW_URL) return 'VITE_SUPABASE_URL is missing, so pins can’t be shared.';
  if (!SUPABASE_URL)
    return `VITE_SUPABASE_URL should be the full project URL — https://your-ref.supabase.co — not “${RAW_URL}”.`;
  if (!RAW_KEY) return 'VITE_SUPABASE_ANON_KEY is missing, so pins can’t be shared.';
  if (looksSecret(RAW_KEY))
    return 'VITE_SUPABASE_ANON_KEY looks like a secret/service_role key. Use the publishable key instead — a secret key in a website grants everyone admin access.';
  return 'VITE_SUPABASE_ANON_KEY looks too short to be a real key.';
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!isCloudConfigured()) throw new Error('Supabase is not configured');
    client = createClient(SUPABASE_URL, RAW_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 4 } },
    });
  }
  return client;
}
