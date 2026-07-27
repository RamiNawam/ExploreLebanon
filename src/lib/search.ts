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

/**
 * Photon indexes OpenStreetMap for type-ahead: it matches on prefixes, so
 * "naqou" finds Naqoura. Nominatim, which we keep as a fallback, only matches
 * whole words and would answer nothing until the name is fully typed.
 */
const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    name?: string;
    countrycode?: string;
    country?: string;
    state?: string;
    county?: string;
    city?: string;
    district?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

/**
 * Photon indexes every tagged object, so a bare prefix pulls in bank branches
 * and street names alongside the villages. Settlements rank first, landmarks
 * next, and the rest is dropped.
 */
const KEY_RANK: Record<string, number> = {
  place: 0,
  natural: 1,
  tourism: 1,
  historic: 1,
  waterway: 1,
  leisure: 2,
  landuse: 2,
};

const DROPPED_KEYS = new Set([
  'amenity',
  'shop',
  'office',
  'highway',
  'railway',
  'building',
  'man_made',
  'craft',
  'healthcare',
  'emergency',
  'barrier',
  'power',
  'aeroway',
]);

interface NominatimRow {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
}

/** "Tyre District, South Governorate" — the useful half of an address. */
function addressLine(props: PhotonFeature['properties']): string {
  const parts = [props.city ?? props.district, props.county, props.state].filter(
    (p): p is string => !!p
  );
  return [...new Set(parts)].slice(0, 2).join(', ') || 'Lebanon';
}

export async function searchRemote(query: string, signal: AbortSignal): Promise<Found[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const hits = await searchPhoton(q, signal);
    if (hits.length) return hits;
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    console.warn('Photon unavailable, falling back to Nominatim', err);
  }
  return searchNominatim(q, signal);
}

async function searchPhoton(q: string, signal: AbortSignal): Promise<Found[]> {
  const [[s, w], [n, e]] = LEBANON_BOUNDS;
  const url =
    `${PHOTON}?q=${encodeURIComponent(q)}&limit=12&lang=en` +
    `&bbox=${w},${s},${e},${n}&lat=33.85&lon=35.85`;

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Search is unavailable (${response.status})`);
  const body: { features?: PhotonFeature[] } = await response.json();

  const folded = fold(q);
  const seen = new Set<string>();

  return (body.features ?? [])
    .filter((f) => {
      const code = f.properties.countrycode?.toUpperCase();
      // The bbox is a bias, not a filter — drop anything across the border.
      if (code && code !== 'LB') return false;
      if (!f.properties.name) return false;
      return !DROPPED_KEYS.has(f.properties.osm_key ?? '');
    })
    .map((f, i) => {
      const [lng, lat] = f.geometry.coordinates;
      return {
        found: {
          id: `photon:${f.properties.osm_id ?? i}`,
          name: f.properties.name as string,
          detail: addressLine(f.properties),
          kind: 'place' as const,
          lat,
          lng,
          local: false,
        },
        rank: KEY_RANK[f.properties.osm_key ?? ''] ?? 3,
      };
    })
    .filter(({ found }) => {
      if (!Number.isFinite(found.lat) || !Number.isFinite(found.lng)) return false;
      if (!inRegion(found.lat, found.lng)) return false;
      // The same village is often mapped as both a node and an area.
      const key = fold(found.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const aStarts = fold(a.found.name).startsWith(folded);
      const bStarts = fold(b.found.name).startsWith(folded);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.found.name.length - b.found.name.length;
    })
    .slice(0, 8)
    .map(({ found }) => found);
}

async function searchNominatim(q: string, signal: AbortSignal): Promise<Found[]> {
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
      const parts = row.display_name.split(',').map((p) => p.trim());
      return {
        id: `osm:${row.place_id}`,
        name: row.name || parts[0],
        detail: parts.slice(1, -1).slice(0, 2).join(', ') || 'Lebanon',
        kind: 'place' as const,
        lat: Number(row.lat),
        lng: Number(row.lon),
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
