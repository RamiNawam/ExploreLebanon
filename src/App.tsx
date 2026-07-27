import { useCallback, useEffect, useMemo, useState } from 'react';
import MapView, { type BasemapId, type MapApi } from './components/MapView';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import PinDetail from './components/PinDetail';
import PinEditor from './components/PinEditor';
import Splash from './components/Splash';
import { usePins } from './hooks/usePins';
import { today } from './lib/format';
import { readPhotoMeta } from './lib/exif';
import { repo } from './lib/repo';
import { describeError } from './lib/errors';
import { inRegion } from './lib/geo';
import type { Photo, Pin, PinDraft, PinKind } from './types';

const SIDEBAR_WIDTH = 376;
const RAIL_WIDTH = 56;
const DETAIL_WIDTH = 400;

export default function App() {
  const { pins, ready, mode, setupWarning, error, clearError, save, remove, move, toggleDone } =
    usePins();

  const [entered, setEntered] = useState(false);
  // On a phone the log would cover the whole map, so it starts tucked away.
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 900);
  const [tab, setTab] = useState<PinKind>('adventure');
  const [governorate, setGovernorate] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PinDraft | null>(null);
  const [placing, setPlacing] = useState<PinKind | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>('map');
  const [showDistricts, setShowDistricts] = useState(false);
  const [showPlaces, setShowPlaces] = useState(true);
  const [api, setApi] = useState<MapApi | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [warningShown, setWarningShown] = useState(true);
  const [notice, setNotice] = useState('');
  const [readingPhoto, setReadingPhoto] = useState(false);
  /** A photo waiting for the tap that says where it belongs. */
  const [pendingPhoto, setPendingPhoto] = useState<{ photo: Photo; date: string } | null>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 900);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 899px)');
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /* Escape backs out of whatever mode we're in. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (placing) setPlacing(null);
      else if (movingId) setMovingId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing, movingId]);

  const onMap = useMemo(
    () => (governorate ? pins.filter((pin) => pin.governorate === governorate) : pins),
    [pins, governorate]
  );

  /** The log reads as a journal: earliest trip first. */
  const listed = useMemo(
    () => onMap.filter((pin) => pin.kind === tab).sort(oldestFirst),
    [onMap, tab]
  );

  const counts = useMemo(
    () => ({
      adventure: onMap.filter((p) => p.kind === 'adventure').length,
      todo: onMap.filter((p) => p.kind === 'todo').length,
    }),
    [onMap]
  );

  const selected = selectedId ? (pins.find((p) => p.id === selectedId) ?? null) : null;

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const pin = pins.find((p) => p.id === id);
      if (pin) setTab(pin.kind);
      setFocusToken((n) => n + 1);
    },
    [pins]
  );

  const blankDraft = (kind: PinKind, lat: number, lng: number): PinDraft => ({
    kind,
    name: '',
    description: '',
    date: kind === 'adventure' ? today() : '',
    lat,
    lng,
    cover: null,
    photos: [],
    done: false,
  });

  const startNew = (kind: PinKind) => {
    setTab(kind);
    setMovingId(null);
    setSelectedId(null);
    setPendingPhoto(null);
    setPlacing(kind);
  };

  const onPlace = (lat: number, lng: number) => {
    if (!placing) return;
    const next = blankDraft(placing, lat, lng);
    if (pendingPhoto) {
      next.cover = pendingPhoto.photo;
      next.date = placing === 'adventure' ? pendingPhoto.date : '';
      setPendingPhoto(null);
    }
    setDraft(next);
    setPlacing(null);
  };

  /**
   * Pick a photo, land the pin where the camera says it was taken. Phones write
   * GPS and a timestamp into the file, so this usually needs no map work at all.
   */
  const onPhotoPin = async (file: File) => {
    setReadingPhoto(true);
    setNotice('');
    try {
      const [meta, photo] = await Promise.all([readPhotoMeta(file), repo.uploadPhoto(file)]);
      const date = meta.takenOn ?? today();
      const located = meta.lat !== undefined && meta.lng !== undefined;

      if (located && inRegion(meta.lat!, meta.lng!)) {
        setSelectedId(null);
        setPlacing(null);
        setPendingPhoto(null);
        setDraft({
          ...blankDraft(tab, meta.lat!, meta.lng!),
          date: tab === 'adventure' ? date : '',
          cover: photo,
        });
        return;
      }

      // No usable fix — keep the photo and let them point at the spot.
      setPendingPhoto({ photo, date });
      setSelectedId(null);
      setPlacing(tab);
      setNotice(
        located
          ? 'That photo was taken outside Lebanon — tap the map to place the pin.'
          : 'That photo has no location saved. Tap the map to place the pin.'
      );
    } catch (err) {
      console.error(err);
      setNotice(describeError(err, 'That photo could not be read.'));
    } finally {
      setReadingPhoto(false);
    }
  };

  /** Long-press or right-click: skip the two-step flow and open the form. */
  const onLongPress = (lat: number, lng: number) => {
    setPlacing(null);
    setSelectedId(null);
    setDraft(blankDraft(tab, lat, lng));
  };

  const onMoveTo = async (lat: number, lng: number) => {
    if (!movingId) return;
    const id = movingId;
    setMovingId(null);
    await move(id, lat, lng);
    select(id);
  };

  const onSave = async (next: PinDraft) => {
    const pin = await save(next);
    if (!pin) return; // keep the form open so nothing typed is lost
    setDraft(null);
    setTab(pin.kind);
    setSelectedId(pin.id);
    setFocusToken((n) => n + 1);
  };

  const onDelete = async (pin: Pin) => {
    await remove(pin.id);
    if (selectedId === pin.id) setSelectedId(null);
  };

  const onEdit = (pin: Pin) => {
    setDraft({
      id: pin.id,
      kind: pin.kind,
      name: pin.name,
      description: pin.description,
      date: pin.date || today(),
      lat: pin.lat,
      lng: pin.lng,
      cover: pin.cover,
      photos: pin.photos,
      done: pin.done,
    });
  };

  const offsetLeft = narrow ? 0 : collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH;
  const offsetRight = narrow || !selected ? 0 : DETAIL_WIDTH;
  const offsetTop = narrow ? 96 : 112;
  // On a phone the open card is a bottom sheet, so pins need to fly higher up.
  const offsetBottom = narrow && selected ? Math.round(window.innerHeight * 0.62) : 0;

  if (!entered) {
    return <Splash onExplore={() => setEntered(true)} />;
  }

  return (
    <div
      className={`app${collapsed ? ' is-collapsed' : ''}${selected ? ' has-detail' : ''}`}
      data-ready={ready}
    >
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        tab={tab}
        onTab={setTab}
        pins={listed}
        counts={counts}
        selectedId={selectedId}
        onSelect={select}
        onNew={startNew}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleDone={(pin) => toggleDone(pin.id)}
        shared={mode === 'cloud'}
      />

      <main className="stage">
        <MapView
          pins={onMap}
          selectedId={selectedId}
          onSelect={select}
          placing={placing}
          onPlace={onPlace}
          onLongPress={onLongPress}
          movingId={movingId}
          onMoveTo={onMoveTo}
          governorate={governorate}
          onGovernorate={(name) => setGovernorate((prev) => (prev === name ? '' : name))}
          basemap={basemap}
          showDistricts={showDistricts}
          showPlaces={showPlaces}
          offsetLeft={offsetLeft}
          offsetRight={offsetRight}
          offsetTop={offsetTop}
          offsetBottom={offsetBottom}
          focusToken={focusToken}
          onReady={setApi}
        />

        <Toolbar
          governorate={governorate}
          onGovernorate={setGovernorate}
          basemap={basemap}
          onBasemap={setBasemap}
          showDistricts={showDistricts}
          onShowDistricts={setShowDistricts}
          showPlaces={showPlaces}
          onShowPlaces={setShowPlaces}
          api={api}
          onNew={startNew}
          onPhotoPin={onPhotoPin}
          readingPhoto={readingPhoto}
        />

        {(placing || movingId) && (
          <div className={`hint hint--${placing ?? 'move'}`}>
            <span className={`dot dot--${placing ?? 'move'}`} />
            {movingId
              ? 'Click the map to move this pin.'
              : pendingPhoto
                ? 'Click the map to place your photo.'
                : placing === 'adventure'
                  ? 'Click the map where the adventure happened.'
                  : 'Click the map where you want to go.'}
            <button
              type="button"
              onClick={() => {
                setPlacing(null);
                setMovingId(null);
                setPendingPhoto(null);
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {!ready && <div className="loading-pill">Loading the map…</div>}

        {error && (
          <div className="toast toast--error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={clearError} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="toast toast--info" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {!error && !notice && setupWarning && warningShown && (
          <div className="toast toast--warn" role="alert">
            <span>
              <strong>Pins are only saving on this device.</strong> {setupWarning}
            </span>
            <button type="button" onClick={() => setWarningShown(false)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        {selected && (
          <PinDetail
            pin={selected}
            onClose={() => setSelectedId(null)}
            onEdit={onEdit}
            onDelete={onDelete}
            onReposition={(pin) => {
              setSelectedId(pin.id);
              setPlacing(null);
              setMovingId(pin.id);
            }}
            onToggleDone={(pin) => toggleDone(pin.id)}
          />
        )}
      </main>

      {draft && <PinEditor draft={draft} onSave={onSave} onCancel={() => setDraft(null)} />}
    </div>
  );
}

function oldestFirst(a: Pin, b: Pin): number {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return a.createdAt - b.createdAt;
}
