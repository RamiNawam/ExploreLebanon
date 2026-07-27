import type { Photo, Pin } from '../types';
import { pinStore } from './idb';
import { fileToPhoto, resizeFile } from './images';
import { getSupabase, PHOTO_BUCKET, isCloudConfigured } from './supabase';

export type RepoMode = 'cloud' | 'device';

export interface PinRepo {
  mode: RepoMode;
  list(): Promise<Pin[]>;
  save(pin: Pin): Promise<Pin>;
  remove(pin: Pin): Promise<void>;
  /** Resize a picked file and put it wherever this repo keeps pictures. */
  uploadPhoto(file: File): Promise<Photo>;
  /** Live updates from other people's browsers. Returns an unsubscribe fn. */
  watch(onChange: () => void): () => void;
}

/* ------------------------------------------------------------------ device */

const deviceRepo: PinRepo = {
  mode: 'device',
  list: () => pinStore.all(),
  save: async (pin) => {
    await pinStore.put(pin);
    return pin;
  },
  remove: (pin) => pinStore.remove(pin.id),
  uploadPhoto: fileToPhoto,
  watch: () => () => undefined,
};

/* ------------------------------------------------------------------- cloud */

interface PinRow {
  id: string;
  kind: 'adventure' | 'todo';
  name: string;
  description: string | null;
  date: string | null;
  lat: number;
  lng: number;
  governorate: string | null;
  cover: Photo | null;
  photos: Photo[] | null;
  done: boolean;
  created_at: string;
  updated_at: string;
}

function rowToPin(row: PinRow): Pin {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description ?? '',
    date: row.date ?? '',
    lat: row.lat,
    lng: row.lng,
    governorate: row.governorate ?? '',
    cover: row.cover,
    photos: row.photos ?? [],
    done: row.done,
    createdAt: Date.parse(row.created_at) || Date.now(),
    updatedAt: Date.parse(row.updated_at) || Date.now(),
  };
}

function pinToRow(pin: Pin): PinRow {
  return {
    id: pin.id,
    kind: pin.kind,
    name: pin.name,
    description: pin.description,
    date: pin.date || null,
    lat: pin.lat,
    lng: pin.lng,
    governorate: pin.governorate,
    cover: pin.cover,
    photos: pin.photos,
    done: pin.done,
    created_at: new Date(pin.createdAt).toISOString(),
    updated_at: new Date(pin.updatedAt).toISOString(),
  };
}

/** Storage paths for a photo's two sizes. */
const photoPath = (id: string, size: 'full' | 'thumb') => `${id}/${size}.jpg`;

const cloudRepo: PinRepo = {
  mode: 'cloud',
  async list() {
    const { data, error } = await getSupabase()
      .from('pins')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as PinRow[]).map(rowToPin);
  },

  async save(pin) {
    const { error } = await getSupabase().from('pins').upsert(pinToRow(pin));
    if (error) throw new Error(error.message);
    return pin;
  },

  async remove(pin) {
    const db = getSupabase();
    const { error } = await db.from('pins').delete().eq('id', pin.id);
    if (error) throw new Error(error.message);
    // Best effort: drop the pictures this pin owned so the bucket stays tidy.
    const ids = [...(pin.cover ? [pin.cover.id] : []), ...pin.photos.map((p) => p.id)];
    if (ids.length) {
      const paths = ids.flatMap((id) => [photoPath(id, 'full'), photoPath(id, 'thumb')]);
      await db.storage.from(PHOTO_BUCKET).remove(paths);
    }
  },

  async uploadPhoto(file) {
    const db = getSupabase();
    const id = crypto.randomUUID();
    const [full, thumb] = await Promise.all([resizeFile(file, 'full'), resizeFile(file, 'thumb')]);

    const put = async (blob: Blob, size: 'full' | 'thumb') => {
      const path = photoPath(id, size);
      const { error } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      return db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    };

    return { id, full: await put(full, 'full'), thumb: await put(thumb, 'thumb') };
  },

  watch(onChange) {
    const channel = getSupabase()
      .channel('pins-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pins' }, onChange)
      .subscribe();
    return () => {
      void getSupabase().removeChannel(channel);
    };
  },
};

export const repo: PinRepo = isCloudConfigured() ? cloudRepo : deviceRepo;
