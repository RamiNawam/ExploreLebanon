/**
 * Turn whatever Supabase, PostgREST or fetch threw into something a person
 * setting this up can act on.
 */
export function describeError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const text = raw.toLowerCase();

  // fetch() rejects like this for DNS failures, offline, and CORS blocks.
  if (
    text.includes('failed to fetch') ||
    text.includes('load failed') ||
    text.includes('networkerror') ||
    text.includes('err_name_not_resolved')
  ) {
    return 'Can’t reach the shared map. Check the Supabase project URL and key, and your connection.';
  }

  if (text.includes('does not exist') || text.includes('schema cache')) {
    return 'The shared map’s database tables are missing. Run supabase/schema.sql in the Supabase SQL editor.';
  }

  if (text.includes('row-level security') || text.includes('violates row-level')) {
    return 'The database is rejecting writes. Re-run supabase/schema.sql so the access policies are in place.';
  }

  if (text.includes('jwt') || text.includes('api key') || text.includes('invalid key')) {
    return 'Supabase rejected the key. Copy the publishable key again from Settings → API Keys.';
  }

  if (text.includes('bucket not found')) {
    return 'The pin-photos storage bucket is missing. Re-run supabase/schema.sql.';
  }

  if (text.includes('exceeded') || text.includes('too large') || text.includes('payload')) {
    return 'That picture was too large for the storage bucket to accept.';
  }

  return raw || fallback;
}
