import { PLACES, type PlaceKind } from '../data/places';
import { LEBANON_BOUNDS, governorateAt, inRegion } from './geo';

export interface Found {
  id: string;
  name: string;
  /** Governorate, or the fuller address line from OpenStreetMap. */
  detail: string;
  kind: PlaceKind | 'place';
  lat: number;
  lng: number;
  /** Curated entries rank above anything fetched. */
  local: boolean;
}

/** Strip accents and case so "zahle" finds "Zahlé". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function searchLocal(query: string): Found[] {
  const q = fold(query);
  if (!q) return [];
  return PLACES.filter((p) => fold(p.name).includes(q) || (p.arabic ?? '').includes(query.trim()))
    .slice(0, 6)
    .map((p) => ({
      id: `local:${p.name}`,
      name: p.name,
      detail: p.kind === 'river' ? 'River' : governorateAt(p.lat, p.lng) || 'Lebanon',
      kind: p.kind,
      lat: p.lat,
      lng: p.lng,
      local: true,
    }))
    .sort((a, b) => {
      // Whole-word starts beat mid-word matches: "Sidon" before "Sidon River".
      const aStarts = fold(a.name).startsWith(q);
      const bStarts = fold(b.name).startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.name.length - b.name.length;
    });
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

interface NominatimRow {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  addresstype?: string;
  type?: string;
}

/**
 * Every village in the country, via OpenStreetMap's geocoder. Callers debounce
 * and pass an abort signal, which keeps us well inside Nominatim's 1 req/s
 * usage policy.
 */
export async function searchRemote(query: string, signal: AbortSignal): Promise<Found[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const [[s, w], [n, e]] = LEBANON_BOUNDS;
  const url =
    `${NOMINATIM}?format=jsonv2&limit=8&accept-language=en&countrycodes=lb` +
    `&viewbox=${w},${n},${e},${s}&q=${encodeURIComponent(q)}`;

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Search is unavailable (${response.status})`);
  const rows: NominatimRow[] = await response.json();

  return rows
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      const parts = row.display_name.split(',').map((p) => p.trim());
      return {
        id: `osm:${row.place_id}`,
        name: row.name || parts[0],
        // Drop the leading name and the trailing "Lebanon" from the address.
        detail: parts.slice(1, -1).slice(0, 2).join(', ') || 'Lebanon',
        kind: 'place' as const,
        lat,
        lng,
        local: false,
      };
    })
    .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng) && inRegion(f.lat, f.lng));
}

/** Curated hits first, then anything from OSM we don't already have. */
export function mergeResults(local: Found[], remote: Found[]): Found[] {
  const seen = new Set(local.map((f) => fold(f.name)));
  const extra = remote.filter((f) => {
    const key = fold(f.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...local, ...extra].slice(0, 10);
}
