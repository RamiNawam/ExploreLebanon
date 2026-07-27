import { useState } from 'react';
import type { BasemapId, MapApi } from './MapView';
import type { PinKind } from '../types';
import Cedar from './Cedar';
import PlaceSearch from './PlaceSearch';
import type { Found } from '../lib/search';

interface Props {
  basemap: BasemapId;
  onBasemap: (id: BasemapId) => void;
  showDistricts: boolean;
  onShowDistricts: (value: boolean) => void;
  showPlaces: boolean;
  onShowPlaces: (value: boolean) => void;
  api: MapApi | null;
  onNew: (kind: PinKind) => void;
  /** Drop a pin wherever a chosen photo says it was taken. */
  onPhotoPin: (file: File) => void;
  readingPhoto: boolean;
  onFindPlace: (place: Found) => void;
}

const BASEMAPS: { id: BasemapId; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'satellite', label: 'Satellite' },
];

export default function Toolbar(props: Props) {
  const {
    basemap,
    onBasemap,
    showDistricts,
    onShowDistricts,
    showPlaces,
    onShowPlaces,
    api,
    onNew,
    onPhotoPin,
    readingPhoto,
    onFindPlace,
  } = props;

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <div className="topbar">
        <div className="topbar__row">
          <div className="brand">
            <Cedar className="brand__cedar" />
            <span className="brand__text">
              Lebanon <em>Adventure</em>
            </span>
          </div>

          <PlaceSearch onPick={onFindPlace} />

          <div className="topbar__right">
            <button
              type="button"
              className="new-btn new-btn--adventure"
              onClick={() => onNew('adventure')}
            >
              <span className="dot dot--adventure" />
              Adventure
            </button>
            <button type="button" className="new-btn new-btn--todo" onClick={() => onNew('todo')}>
              <span className="dot dot--todo" />
              To-do
            </button>
            <label
              className={`new-btn new-btn--photo${readingPhoto ? ' is-busy' : ''}`}
              title="Pick a photo and drop the pin where it was taken"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9Z"
                />
                <circle
                  cx="12"
                  cy="13"
                  r="3.4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
              </svg>
              {readingPhoto ? 'Reading…' : 'From photo'}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={readingPhoto}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ''; // let the same photo be picked twice
                  if (file) onPhotoPin(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className={`mapctl${settingsOpen ? ' is-open' : ''}`}>
        {settingsOpen && (
          <div className="mapctl__panel">
            <div className="mapctl__group">
              {BASEMAPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`mapctl__tab${basemap === b.id ? ' is-on' : ''}`}
                  onClick={() => onBasemap(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="mapctl__group mapctl__group--stack">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showPlaces}
                  onChange={(e) => onShowPlaces(e.target.checked)}
                />
                <span />
                Cities &amp; rivers
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showDistricts}
                  onChange={(e) => onShowDistricts(e.target.checked)}
                />
                <span />
                Districts
              </label>
            </div>
          </div>
        )}

        <div className="mapctl__group mapctl__group--zoom">
          <button
            type="button"
            className={`mapctl__settings${settingsOpen ? ' is-on' : ''}`}
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            aria-label={settingsOpen ? 'Hide map settings' : 'Map settings'}
            title="Map settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
                d="m12 3 9 5-9 5-9-5 9-5Z"
              />
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4 12.5 8 4.5 8-4.5"
              />
            </svg>
          </button>
          <button type="button" onClick={() => api?.zoomIn()} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button
            type="button"
            onClick={() => api?.zoomOut()}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => api?.reset()}
            aria-label="Fit Lebanon"
            title="Fit all of Lebanon"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
