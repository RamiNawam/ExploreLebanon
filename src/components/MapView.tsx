import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Pin, PinKind } from '../types';
import {
  DISTRICTS,
  GOVERNORATES,
  LEBANON,
  LEBANON_BOUNDS,
  latLngRings,
  worldMinusLebanon,
  areaBounds,
  areaCentre,
} from '../lib/geo';
import { PLACES } from '../data/places';

export type BasemapId = 'map' | 'terrain' | 'satellite';

export interface MapApi {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface Props {
  pins: Pin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  placing: PinKind | null;
  onPlace: (lat: number, lng: number) => void;
  movingId: string | null;
  onMoveTo: (lat: number, lng: number) => void;
  governorate: string;
  onGovernorate: (name: string) => void;
  basemap: BasemapId;
  showDistricts: boolean;
  showPlaces: boolean;
  /** Horizontal px of chrome covering the map (sidebar left, detail card right). */
  offsetLeft: number;
  offsetRight: number;
  focusToken: number;
  onReady: (api: MapApi) => void;
}

const TILES: Record<BasemapId, { url: string; attribution: string; maxZoom: number }> = {
  map: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  terrain: {
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM &middot; OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
  },
};

const LABELS_OVERLAY = 'https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';

function pinIcon(pin: Pin, selected: boolean): L.DivIcon {
  const glyph =
    pin.kind === 'adventure'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 8.5 9h2.2L7.6 14h2.4L6.5 19h11L14 14h2.4l-3.1-5h2.2L12 3Z"/><rect x="11.2" y="19" width="1.6" height="2.4" rx=".6"/></svg>'
      : pin.done
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7.5l-1.6-1.6L9.5 13.8 6.6 10.9 5 12.5Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 4v4.3l3.2 1.9-.8 1.3L11.5 13V8H13Z"/></svg>';

  const classes = [
    'pin',
    `pin--${pin.kind}`,
    selected ? 'is-selected' : '',
    pin.done ? 'is-done' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="${classes}">
        <span class="pin__pulse"></span>
        <span class="pin__drop"><span class="pin__glyph">${glyph}</span></span>
        <span class="pin__stem"></span>
        <span class="pin__label">${escapeHtml(pin.name)}</span>
      </div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

function zoomBand(zoom: number): string {
  if (zoom <= 9) return 'zoom-far';
  if (zoom <= 11) return 'zoom-mid';
  return 'zoom-near';
}

export default function MapView(props: Props) {
  const {
    pins,
    selectedId,
    onSelect,
    placing,
    onPlace,
    movingId,
    onMoveTo,
    governorate,
    onGovernorate,
    basemap,
    showDistricts,
    showPlaces,
    offsetLeft,
    offsetRight,
    focusToken,
    onReady,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const labelsRef = useRef<L.TileLayer | null>(null);
  const govLayerRef = useRef<Map<string, L.Polygon>>(new Map());
  const govLabelsRef = useRef<L.LayerGroup | null>(null);
  const districtRef = useRef<L.LayerGroup | null>(null);
  const placesRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const pinLayerRef = useRef<L.LayerGroup | null>(null);

  // Latest values for the map's own event handlers, which are bound only once.
  const handlers = useRef({ placing, onPlace, movingId, onMoveTo, onSelect });
  handlers.current = { placing, onPlace, movingId, onMoveTo, onSelect };

  /* ---------------------------------------------------------------- set-up */
  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 7.5,
      maxZoom: 18,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 120,
      maxBounds: L.latLngBounds(LEBANON_BOUNDS).pad(0.25),
      maxBoundsViscosity: 1,
    });
    mapRef.current = map;
    map.fitBounds(LEBANON_BOUNDS, { padding: [40, 40] });

    // Everything outside the border is painted out, so only Lebanon shows.
    L.polygon(worldMinusLebanon(), {
      className: 'world-mask',
      stroke: false,
      fillColor: '#0b1710',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);

    // Governorate shapes, dimmed or highlighted by the active filter.
    const govLayer = L.layerGroup().addTo(map);
    GOVERNORATES.forEach((area) => {
      const poly = L.polygon(latLngRings(area), {
        interactive: false,
        color: '#2f5d43',
        weight: 1,
        opacity: 0.55,
        fillColor: '#3d7a56',
        fillOpacity: 0.05,
      }).addTo(govLayer);
      govLayerRef.current.set(area.name, poly);
    });

    // The gilded country outline sits above the fills.
    L.polyline(latLngRings(LEBANON), {
      color: '#c9a24b',
      weight: 2.5,
      opacity: 0.95,
      interactive: false,
      className: 'country-outline',
    }).addTo(map);

    // Clickable governorate names, doubling as the map-side filter control.
    const govLabels = L.layerGroup().addTo(map);
    govLabelsRef.current = govLabels;
    GOVERNORATES.forEach((area) => {
      L.marker(areaCentre(area), {
        icon: L.divIcon({
          className: 'gov-label-wrap',
          html: `<button type="button" class="gov-label" data-gov="${escapeHtml(area.name)}">${escapeHtml(area.name)}</button>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: true,
        keyboard: false,
      })
        .on('click', () => onGovernorate(area.name))
        .addTo(govLabels);
    });

    // District (caza) boundaries — a finer grid, toggled from the toolbar.
    const districts = L.layerGroup();
    districtRef.current = districts;
    DISTRICTS.forEach((area) => {
      L.polygon(latLngRings(area), {
        interactive: false,
        color: '#8a7a55',
        weight: 0.9,
        opacity: 0.7,
        dashArray: '3 4',
        fill: false,
      }).addTo(districts);
      L.marker(areaCentre(area), {
        interactive: false,
        icon: L.divIcon({
          className: 'district-label-wrap',
          html: `<span class="district-label">${escapeHtml(area.name)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      }).addTo(districts);
    });

    // Curated cities, towns, sites and rivers.
    const places = L.layerGroup().addTo(map);
    placesRef.current = places;
    PLACES.forEach((place) => {
      L.marker([place.lat, place.lng], {
        interactive: false,
        icon: L.divIcon({
          className: 'plabel-wrap',
          html: `<span class="plabel plabel--${place.kind}">
              <i class="plabel__dot"></i>
              <span class="plabel__text">${escapeHtml(place.name)}</span>
            </span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      }).addTo(places);
    });

    pinLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      const state = handlers.current;
      if (state.movingId) state.onMoveTo(lat, lng);
      else if (state.placing) state.onPlace(lat, lng);
      else state.onSelect(null);
    });

    const applyZoomBand = () => {
      const host = hostRef.current;
      if (!host) return;
      host.classList.remove('zoom-far', 'zoom-mid', 'zoom-near');
      host.classList.add(zoomBand(map.getZoom()));
    };
    map.on('zoomend', applyZoomBand);
    applyZoomBand();

    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(hostRef.current);

    onReady({
      zoomIn: () => map.zoomIn(1),
      zoomOut: () => map.zoomOut(1),
      reset: () => map.flyToBounds(LEBANON_BOUNDS, { padding: [40, 40], duration: 1 }),
    });

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      govLayerRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- basemaps */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const spec = TILES[basemap];
    baseRef.current?.remove();
    baseRef.current = L.tileLayer(spec.url, {
      attribution: spec.attribution,
      maxZoom: spec.maxZoom,
      maxNativeZoom: spec.maxZoom,
      // Only fetch tiles that touch Lebanon — nothing around it is ever drawn.
      bounds: L.latLngBounds(LEBANON_BOUNDS).pad(0.02),
      className: `tiles tiles--${basemap}`,
    }).addTo(map);
    baseRef.current.setZIndex(1);

    labelsRef.current?.remove();
    labelsRef.current = null;
    if (basemap === 'satellite') {
      labelsRef.current = L.tileLayer(LABELS_OVERLAY, {
        opacity: 0.85,
        maxZoom: 18,
        bounds: L.latLngBounds(LEBANON_BOUNDS).pad(0.02),
      }).addTo(map);
      labelsRef.current.setZIndex(2);
    }
    hostRef.current?.classList.toggle('on-satellite', basemap === 'satellite');
  }, [basemap]);

  /* --------------------------------------------------------------- layers */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !districtRef.current) return;
    if (showDistricts) districtRef.current.addTo(map);
    else districtRef.current.remove();
  }, [showDistricts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placesRef.current) return;
    if (showPlaces) placesRef.current.addTo(map);
    else placesRef.current.remove();
  }, [showPlaces]);

  /* -------------------------------------------------- governorate filter */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    govLayerRef.current.forEach((poly, name) => {
      const isActive = !governorate || governorate === name;
      poly.setStyle({
        color: governorate === name ? '#c9a24b' : '#2f5d43',
        weight: governorate === name ? 2.2 : 1,
        opacity: isActive ? 0.8 : 0.25,
        fillColor: governorate === name ? '#c9a24b' : '#3d7a56',
        fillOpacity: governorate === name ? 0.12 : isActive ? 0.05 : 0.02,
      });
    });
    hostRef.current
      ?.querySelectorAll<HTMLElement>('.gov-label')
      .forEach((el) =>
        el.classList.toggle('is-active', el.dataset.gov === governorate && !!governorate)
      );
    if (governorate) {
      const area = GOVERNORATES.find((g) => g.name === governorate);
      if (area) {
        map.flyToBounds(areaBounds(area), {
          paddingTopLeft: [offsetLeft + 40, 90],
          paddingBottomRight: [offsetRight + 40, 60],
          duration: 0.9,
        });
      }
    }
    // Re-fitting on offset changes would fight the user's panning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorate]);

  /* ----------------------------------------------------------------- pins */
  useEffect(() => {
    const layer = pinLayerRef.current;
    if (!layer) return;
    const live = new Set(pins.map((p) => p.id));

    markersRef.current.forEach((marker, id) => {
      if (!live.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    pins.forEach((pin) => {
      const existing = markersRef.current.get(pin.id);
      const icon = pinIcon(pin, pin.id === selectedId);
      if (existing) {
        existing.setLatLng([pin.lat, pin.lng]);
        existing.setIcon(icon);
        existing.setZIndexOffset(pin.id === selectedId ? 1000 : 0);
      } else {
        const marker = L.marker([pin.lat, pin.lng], { icon, riseOnHover: true })
          .on('click', (event) => {
            L.DomEvent.stopPropagation(event);
            handlers.current.onSelect(pin.id);
          })
          .addTo(layer);
        markersRef.current.set(pin.id, marker);
      }
    });
  }, [pins, selectedId]);

  /* ------------------------------------------------- cursor / moving mode */
  useEffect(() => {
    hostRef.current?.classList.toggle('is-picking', !!placing || !!movingId);
  }, [placing, movingId]);

  /* ------------------------------------------- animated focus on a pin */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const pin = pins.find((p) => p.id === selectedId);
    if (!pin) return;

    const zoom = Math.max(map.getZoom(), 14);
    // Nudge the target so the pin lands in the visible slice of the map.
    const shift = (offsetLeft - offsetRight) / 2;
    const point = map.project([pin.lat, pin.lng], zoom).subtract([shift, 40]);
    map.flyTo(map.unproject(point, zoom), zoom, { duration: 1.15, easeLinearity: 0.22 });
    // Only re-run when the selection (or an explicit focus request) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, focusToken]);

  return <div className="map-host" ref={hostRef} />;
}
