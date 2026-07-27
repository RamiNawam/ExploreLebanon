import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** Public Storage bucket holding every pin's pictures. */
export const PHOTO_BUCKET = 'pin-photos';

/**
 * With no Supabase credentials the app still runs — it just keeps pins in this
 * browser instead of sharing them. Deployed builds set both env vars.
 */
export function isCloudConfigured(): boolean {
  return URL.startsWith('http') && ANON_KEY.length > 20;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!isCloudConfigured()) throw new Error('Supabase is not configured');
    client = createClient(URL, ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 4 } },
    });
  }
  return client;
}
