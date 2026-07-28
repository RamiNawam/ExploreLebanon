import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pin, PinDraft } from '../types';
import { repo, type RepoMode } from '../lib/repo';
import { configIssue } from '../lib/supabase';
import { describeError } from '../lib/errors';
import { governorateAt } from '../lib/geo';

export interface PinsApi {
  pins: Pin[];
  ready: boolean;
  mode: RepoMode;
  /** Set when the shared map was configured but the settings don't work. */
  setupWarning: string;
  error: string;
  clearError: () => void;
  save: (draft: PinDraft) => Promise<Pin | null>;
  remove: (id: string) => Promise<void>;
  move: (id: string, lat: number, lng: number) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
}

export function usePins(enabled: boolean): PinsApi {
  const [pins, setPins] = useState<Pin[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  /** Handlers read pins through a ref so they never go stale between renders. */
  const latest = useRef<Pin[]>([]);
  latest.current = pins;

  const reload = useCallback(async () => {
    if (!enabled) return;
    try {
      const all = await repo.list();
      setPins(all.sort(byRecency));
      setError('');
    } catch (err) {
      console.error(err);
      setError(describeError(err, 'Could not reach the shared map.'));
    } finally {
      setReady(true);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    // Someone else adding a pin shows up here without a refresh.
    return repo.watch(() => void reload());
  }, [enabled, reload]);

  const commit = useCallback(async (pin: Pin) => {
    setPins((prev) => {
      const next = prev.some((p) => p.id === pin.id)
        ? prev.map((p) => (p.id === pin.id ? pin : p))
        : [...prev, pin];
      return next.sort(byRecency);
    });
    await repo.save(pin);
    return pin;
  }, []);

  const save = useCallback(
    async (draft: PinDraft) => {
      const now = Date.now();
      const existing = draft.id ? latest.current.find((p) => p.id === draft.id) : undefined;
      const pin: Pin = {
        id: draft.id ?? crypto.randomUUID(),
        kind: draft.kind,
        name: draft.name.trim() || 'Untitled',
        description: draft.description.trim(),
        date: draft.kind === 'adventure' ? draft.date : '',
        lat: draft.lat,
        lng: draft.lng,
        governorate: governorateAt(draft.lat, draft.lng),
        cover: draft.cover,
        photos: draft.photos,
        done: draft.done,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      try {
        return await commit(pin);
      } catch (err) {
        console.error(err);
        setError(describeError(err, 'That pin could not be saved.'));
        void reload();
        return null;
      }
    },
    [commit, reload]
  );

  const remove = useCallback(
    async (id: string) => {
      const pin = latest.current.find((p) => p.id === id);
      if (!pin) return;
      setPins((prev) => prev.filter((p) => p.id !== id));
      try {
        await repo.remove(pin);
      } catch (err) {
        console.error(err);
        setError(describeError(err, 'That pin could not be deleted.'));
        void reload();
      }
    },
    [reload]
  );

  const patch = useCallback(
    async (id: string, changes: Partial<Pin>) => {
      const pin = latest.current.find((p) => p.id === id);
      if (!pin) return;
      try {
        await commit({ ...pin, ...changes, updatedAt: Date.now() });
      } catch (err) {
        console.error(err);
        setError(describeError(err, 'That change could not be saved.'));
        void reload();
      }
    },
    [commit, reload]
  );

  const move = useCallback(
    (id: string, lat: number, lng: number) =>
      patch(id, { lat, lng, governorate: governorateAt(lat, lng) }),
    [patch]
  );

  const toggleDone = useCallback(
    (id: string) => {
      const pin = latest.current.find((p) => p.id === id);
      return pin ? patch(id, { done: !pin.done }) : Promise.resolve();
    },
    [patch]
  );

  return {
    pins,
    ready,
    mode: repo.mode,
    setupWarning: configIssue(),
    error,
    clearError: () => setError(''),
    save,
    remove,
    move,
    toggleDone,
  };
}

/** Adventures read best newest-first by trip date, falling back to when they were logged. */
function byRecency(a: Pin, b: Pin): number {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return b.createdAt - a.createdAt;
}
