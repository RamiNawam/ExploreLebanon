import lebanonRaw from '../data/lebanon.json';
import governoratesRaw from '../data/governorates.json';
import districtsRaw from '../data/districts.json';

type Ring = [number, number][];
type PolygonCoords = Ring[];
type MultiPolygonCoords = PolygonCoords[];

interface Geometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: PolygonCoords | MultiPolygonCoords;
}

export interface Area {
  name: string;
  geometry: Geometry;
}

/** geoBoundaries ships French/transliterated labels; these read better in the UI. */
const NAME_OVERRIDES: Record<string, string> = {
  Beyrouth: 'Beirut',
  'Mont-Liban': 'Mount Lebanon',
  'Liban-Nord': 'North Lebanon',
  'Liban-Sud': 'South Lebanon',
  Nabatîyé: 'Nabatieh',
  Béqaa: 'Beqaa',
  Aakkâr: 'Akkar',
  'Keserwan-Jbeil': 'Keserwan–Jbeil',
  'Baalbek-Hermel': 'Baalbek–Hermel',
  Sour: 'Tyre (Sour)',
  Saida: 'Sidon (Saida)',
  Jbail: 'Byblos (Jbeil)',
  Bcharre: 'Bsharri',
  Bent_Jbail: 'Bint Jbeil',
  'Bent Jbail': 'Bint Jbeil',
  Kesrouan: 'Keserwan',
  Zgharta: 'Zgharta',
  'Minieh-Dinnieh': 'Minieh–Danniyeh',
};

function toAreas(raw: unknown): Area[] {
  const fc = raw as { features: { properties: { name: string }; geometry: Geometry }[] };
  return fc.features.map((f) => ({
    name: NAME_OVERRIDES[f.properties.name] ?? f.properties.name,
    geometry: f.geometry,
  }));
}

export const LEBANON: Area = toAreas(lebanonRaw)[0];
export const GOVERNORATES: Area[] = toAreas(governoratesRaw).sort((a, b) =>
  a.name.localeCompare(b.name)
);
export const DISTRICTS: Area[] = toAreas(districtsRaw).sort((a, b) => a.name.localeCompare(b.name));


/** Every polygon in a geometry, as arrays of [lng, lat] rings. */
function polygonsOf(geometry: Geometry): PolygonCoords[] {
  return geometry.type === 'Polygon'
    ? [geometry.coordinates as PolygonCoords]
    : (geometry.coordinates as MultiPolygonCoords);
}

function ringContains(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > lat !== yj > lat;
    if (straddles && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function areaContains(area: Area, lat: number, lng: number): boolean {
  for (const poly of polygonsOf(area.geometry)) {
    const [outer, ...holes] = poly;
    if (!ringContains(outer, lng, lat)) continue;
    if (holes.some((hole) => ringContains(hole, lng, lat))) continue;
    return true;
  }
  return false;
}

/**
 * Which governorate a dropped pin belongs to. Beach and harbour pins often land
 * a few metres offshore, past the coastline the boundaries are clipped to, so
 * anything within a few km of a governorate is credited to it.
 */
export function governorateAt(lat: number, lng: number): string {
  const hit = GOVERNORATES.find((g) => areaContains(g, lat, lng));
  if (hit) return hit.name;

  const NEAR_DEG = 0.05; // ~5 km
  let best = '';
  let bestDist = NEAR_DEG;
  for (const area of GOVERNORATES) {
    const d = distanceToArea(area, lat, lng);
    if (d < bestDist) {
      bestDist = d;
      best = area.name;
    }
  }
  return best;
}

/** Rough degrees from a point to an area's edge; only used for short hops. */
function distanceToArea(area: Area, lat: number, lng: number): number {
  const kx = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const poly of polygonsOf(area.geometry)) {
    const ring = poly[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const d = pointToSegment(
        lng * kx,
        lat,
        ring[j][0] * kx,
        ring[j][1],
        ring[i][0] * kx,
        ring[i][1]
      );
      if (d < best) best = d;
    }
  }
  return best;
}

function pointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}


/** Leaflet-ready [lat, lng] rings. */
export function latLngRings(area: Area): [number, number][][] {
  return polygonsOf(area.geometry).flatMap((poly) =>
    poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]))
  );
}

/**
 * A label anchor near the visual middle of an area: the centroid of its largest
 * ring, or the bounding-box centre when that lands in a hole or a concavity.
 */
export function areaCentre(area: Area): [number, number] {
  const rings = polygonsOf(area.geometry).map((poly) => poly[0]);
  const biggest = rings.reduce((a, b) => (Math.abs(ringArea(b)) > Math.abs(ringArea(a)) ? b : a));
  const twiceArea = ringArea(biggest);
  if (twiceArea !== 0) {
    let x = 0;
    let y = 0;
    for (let i = 0, j = biggest.length - 1; i < biggest.length; j = i++) {
      const [x0, y0] = biggest[j];
      const [x1, y1] = biggest[i];
      const cross = x0 * y1 - x1 * y0;
      x += (x0 + x1) * cross;
      y += (y0 + y1) * cross;
    }
    const lng = x / (3 * twiceArea);
    const lat = y / (3 * twiceArea);
    if (areaContains(area, lat, lng)) return [lat, lng];
  }
  const [[s, w], [n, e]] = areaBounds(area);
  return [(s + n) / 2, (w + e) / 2];
}

/** Twice the signed area of a ring — sign tells us its winding. */
function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum;
}

/** [[south, west], [north, east]] */
export function areaBounds(area: Area): [[number, number], [number, number]] {
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  for (const poly of polygonsOf(area.geometry)) {
    for (const [lng, lat] of poly[0]) {
      s = Math.min(s, lat);
      n = Math.max(n, lat);
      w = Math.min(w, lng);
      e = Math.max(e, lng);
    }
  }
  return [
    [s, w],
    [n, e],
  ];
}

export const LEBANON_BOUNDS = areaBounds(LEBANON);

/**
 * How far the map may be panned: Lebanon plus a wide margin, so the coast,
 * the sea and the neighbouring hills stay in view without letting you drift
 * off to another continent.
 */
export const REGION_BOUNDS: [[number, number], [number, number]] = [
  [LEBANON_BOUNDS[0][0] - 0.55, LEBANON_BOUNDS[0][1] - 0.85],
  [LEBANON_BOUNDS[1][0] + 0.55, LEBANON_BOUNDS[1][1] + 0.85],
];

/** Is this somewhere the map can actually show? */
export function inRegion(lat: number, lng: number): boolean {
  const [[s, w], [n, e]] = REGION_BOUNDS;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}
