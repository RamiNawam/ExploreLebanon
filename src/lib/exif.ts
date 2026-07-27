/**
 * Just enough EXIF to answer "where and when was this taken?".
 *
 * Phones write both into the JPEG they hand the file picker, so a photo chosen
 * from the camera roll can place its own pin. Deliberately dependency-free and
 * defensive: a malformed or metadata-free file just yields an empty result.
 */

export interface PhotoMeta {
  lat?: number;
  lng?: number;
  /** ISO date (yyyy-mm-dd) the shutter was pressed. */
  takenOn?: string;
}

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_ORIGINAL = 0x9003;
const TAG_DATE_DIGITIZED = 0x9004;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

interface Cursor {
  view: DataView;
  /** Offset of the TIFF header; every IFD offset is relative to it. */
  tiff: number;
  little: boolean;
}

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    // The EXIF block sits near the front; no need to read a 5 MB photo.
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseExif(head);
  } catch {
    return {};
  }
}

export function parseExif(buffer: ArrayBuffer): PhotoMeta {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {}; // not a JPEG

  const tiff = findExifHeader(view);
  if (tiff < 0) return {};

  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return {};
  const cursor: Cursor = { view, tiff, little: order === 0x4949 };

  if (read16(cursor, tiff + 2) !== 0x2a) return {};
  const ifd0 = tiff + read32(cursor, tiff + 4);
  if (ifd0 <= tiff || ifd0 >= view.byteLength) return {};

  const root = readIfd(cursor, ifd0);
  const meta: PhotoMeta = {};

  const exifOffset = root.get(TAG_EXIF_IFD)?.longValue;
  if (exifOffset !== undefined) {
    const exif = readIfd(cursor, tiff + exifOffset);
    const stamp =
      ascii(cursor, exif.get(TAG_DATE_ORIGINAL)) ?? ascii(cursor, exif.get(TAG_DATE_DIGITIZED));
    const date = toIsoDate(stamp);
    if (date) meta.takenOn = date;
  }

  const gpsOffset = root.get(TAG_GPS_IFD)?.longValue;
  if (gpsOffset !== undefined) {
    const gps = readIfd(cursor, tiff + gpsOffset);
    const lat = degrees(cursor, gps.get(TAG_GPS_LAT), ascii(cursor, gps.get(TAG_GPS_LAT_REF)));
    const lng = degrees(cursor, gps.get(TAG_GPS_LNG), ascii(cursor, gps.get(TAG_GPS_LNG_REF)));
    // 0,0 is the Atlantic null island — that's a missing fix, not a location.
    if (lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0)) {
      meta.lat = lat;
      meta.lng = lng;
    }
  }

  return meta;
}

/** Walk the JPEG segments looking for the APP1 that starts with "Exif\0\0". */
function findExifHeader(view: DataView): number {
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return -1;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return -1; // image data begins
    const length = view.getUint16(offset + 2);
    if (length < 2) return -1;
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      const tag = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );
      if (tag === 'Exif') return offset + 10;
    }
    offset += 2 + length;
  }
  return -1;
}

interface Entry {
  type: number;
  count: number;
  /** Where the payload lives (already absolute). */
  offset: number;
  /** Convenience for the single-LONG pointer tags. */
  longValue?: number;
}

function readIfd(c: Cursor, start: number): Map<number, Entry> {
  const out = new Map<number, Entry>();
  if (start < 0 || start + 2 > c.view.byteLength) return out;
  const count = read16(c, start);
  for (let i = 0; i < count; i++) {
    const at = start + 2 + i * 12;
    if (at + 12 > c.view.byteLength) break;
    const tag = read16(c, at);
    const type = read16(c, at + 2);
    const n = read32(c, at + 4);
    const size = (TYPE_SIZES[type] ?? 0) * n;
    if (!size) continue;
    const offset = size <= 4 ? at + 8 : c.tiff + read32(c, at + 8);
    if (offset < 0 || offset + Math.min(size, 4) > c.view.byteLength) continue;
    const entry: Entry = { type, count: n, offset };
    if (type === 4 && n === 1) entry.longValue = read32(c, at + 8);
    out.set(tag, entry);
  }
  return out;
}

function ascii(c: Cursor, entry?: Entry): string | undefined {
  if (!entry || entry.type !== 2) return undefined;
  let text = '';
  for (let i = 0; i < entry.count; i++) {
    const at = entry.offset + i;
    if (at >= c.view.byteLength) break;
    const code = c.view.getUint8(at);
    if (code === 0) break;
    text += String.fromCharCode(code);
  }
  return text.trim() || undefined;
}

/** Three RATIONALs (degrees, minutes, seconds) plus an N/S/E/W reference. */
function degrees(c: Cursor, entry?: Entry, ref?: string): number | undefined {
  if (!entry || entry.type !== 5 || entry.count < 3) return undefined;
  let value = 0;
  for (let i = 0; i < 3; i++) {
    const at = entry.offset + i * 8;
    if (at + 8 > c.view.byteLength) return undefined;
    const numerator = read32(c, at);
    const denominator = read32(c, at + 4);
    if (!denominator) return undefined;
    value += numerator / denominator / 60 ** i;
  }
  if (!Number.isFinite(value) || Math.abs(value) > 180) return undefined;
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  return Math.round(value * sign * 1e6) / 1e6;
}

/** EXIF writes 'YYYY:MM:DD HH:MM:SS' in local time. */
function toIsoDate(stamp?: string): string | undefined {
  if (!stamp) return undefined;
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(stamp);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  if (+y < 1900 || +mo < 1 || +mo > 12 || +d < 1 || +d > 31) return undefined;
  return `${y}-${mo}-${d}`;
}

function read16(c: Cursor, at: number): number {
  return c.view.getUint16(at, c.little);
}

function read32(c: Cursor, at: number): number {
  return c.view.getUint32(at, c.little);
}
