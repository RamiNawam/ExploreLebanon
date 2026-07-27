import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Pin, PinKind } from '../types';
import {
  DISTRICTS,
  GOVERNORATES,
  LEBANON,
  LEBANON_BOUNDS,
  REGION_BOUNDS,
  latLngRings,
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
  /** Long-press / right-click anywhere on the map drops a pin there. */
  onLongPress: (lat: number, lng: number) => void;
  movingId: string | null;
  onMoveTo: (lat: number, lng: number) => void;
  governorate: string;
  onGovernorate: (name: string) => void;
  basemap: BasemapId;
  showDistricts: boolean;
  showPlaces: boolean;
  /** Px of chrome covering each edge of the map (side panels, toolbar, sheet). */
  offsetLeft: number;
  offsetRight: number;
  offsetTop: number;
  offsetBottom: number;
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

/** How long a press has to last before it counts as "drop a pin here". */
const HOLD_MS = 550;
const HOLD_SLOP = 12;

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
    onLongPress,
    movingId,
    onMoveTo,
    governorate,
    onGovernorate,
    basemap,
    showDistricts,
    showPlaces,
    offsetLeft,
    offsetRight,
    offsetTop,
    offsetBottom,
    focusToken,
    onReady,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const labelsRef = useRef<L.TileLayer | null>(null);
  const govLayerRef = useRef<Map<string, L.Polygon>>(new Map());
  const districtRef = useRef<L.LayerGroup | null>(null);
  const placesRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const pinLayerRef = useRef<L.LayerGroup | null>(null);

  // Latest values for the map's own handlers, which are bound only once.
  const handlers = useRef({ placing, onPlace, movingId, onMoveTo, onSelect, onLongPress });
  handlers.current = { placing, onPlace, movingId, onMoveTo, onSelect, onLongPress };

  /* ---------------------------------------------------------------- set-up */
  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    // Canvas beats SVG by a wide margin here: the boundaries are thousands of
    // points and SVG re-lays-out every one of them on each zoom step.
    const renderer = L.canvas({ padding: 0.5 });

    const map = L.map(hostRef.current, {
      renderer,
      preferCanvas: true,
      zoomControl: false,
      attributionControl: true,
      minZoom: 7.5,
      maxZoom: 18,
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 110,
      zoomAnimation: true,
      maxBounds: L.latLngBounds(REGION_BOUNDS),
      maxBoundsViscosity: 0.9,
      tapHold: true, // long-press on touch fires `contextmenu`
    });
    mapRef.current = map;
    map.fitBounds(LEBANON_BOUNDS, { padding: [40, 40] });

    // Governorate shapes, dimmed or highlighted by the active filter.
    const govLayer = L.layerGroup().addTo(map);
    GOVERNORATES.forEach((area) => {
      const poly = L.polygon(latLngRings(area), {
        renderer,
        interactive: false,
        color: '#2f5d43',
        weight: 1,
        opacity: 0.5,
        fillColor: '#3d7a56',
        fillOpacity: 0.04,
      }).addTo(govLayer);
      govLayerRef.current.set(area.name, poly);
    });

    // Lebanon itself: a warm wash lifts it off its neighbours, and the frontier
    // is a single hairline. Anything heavier sits on top of the town names the
    // basemap draws along the border.
    const rings = latLngRings(LEBANON);
    L.polygon(rings, {
      renderer,
      interactive: false,
      stroke: false,
      fillColor: '#f0d9a0',
      fillOpacity: 0.1,
    }).addTo(map);
    L.polyline(rings, {
      renderer,
      interactive: false,
      color: '#b98f38',
      weight: 1.4,
      opacity: 0.85,
      lineJoin: 'round',
    }).addTo(map);

    // Clickable governorate names, doubling as the map-side filter control.
    const govLabels = L.layerGroup().addTo(map);
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
        renderer,
        interactive: false,
        color: '#8a7a55',
        weight: 0.9,
        opacity: 0.75,
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

    /* ---------------------------------------------------- clicks and holds */

    // A hold that has already dropped a pin must not also count as a click.
    let swallowNextClick = false;

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (swallowNextClick) {
        swallowNextClick = false;
        return;
      }
      const { lat, lng } = event.latlng;
      const state = handlers.current;
      if (state.movingId) state.onMoveTo(lat, lng);
      else if (state.placing) state.onPlace(lat, lng);
      else state.onSelect(null);
    });

    const holdAt = (latlng: L.LatLng) => {
      const state = handlers.current;
      swallowNextClick = true;
      if (state.movingId) state.onMoveTo(latlng.lat, latlng.lng);
      else state.onLongPress(latlng.lat, latlng.lng);
    };

    // Touch long-press (via tapHold) and desktop right-click both land here.
    map.on('contextmenu', (event: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(event.originalEvent);
      holdAt(event.latlng);
    });

    // Holding the left button still on a laptop counts too.
    let holdTimer: number | undefined;
    let holdOrigin: { x: number; y: number } | null = null;

    const cancelHold = () => {
      if (holdTimer !== undefined) window.clearTimeout(holdTimer);
      holdTimer = undefined;
      holdOrigin = null;
      hostRef.current?.classList.remove('is-holding');
    };

    map.on('mousedown', (event: L.LeafletMouseEvent) => {
      const mouse = event.originalEvent;
      // Touch is handled by tapHold; only watch real mouse buttons here.
      const fromTouch = 'pointerType' in mouse && mouse.pointerType === 'touch';
      if (mouse.button !== 0 || fromTouch) return;
      const { latlng } = event;
      holdOrigin = { x: mouse.clientX, y: mouse.clientY };
      hostRef.current?.classList.add('is-holding');
      holdTimer = window.setTimeout(() => {
        cancelHold();
        holdAt(latlng);
      }, HOLD_MS);
    });

    map.on('mousemove', (event: L.LeafletMouseEvent) => {
      if (!holdOrigin) return;
      const { clientX, clientY } = event.originalEvent;
      if (Math.abs(clientX - holdOrigin.x) + Math.abs(clientY - holdOrigin.y) > HOLD_SLOP) {
        cancelHold();
      }
    });

    map.on('mouseup mouseout dragstart zoomstart movestart', cancelHold);

    /* ------------------------------------------------------------ chrome */

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
      cancelHold();
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
      // Fewer requests mid-gesture keeps zooming and panning fluid.
      updateWhenZooming: false,
      keepBuffer: 3,
      className: `tiles tiles--${basemap}`,
    }).addTo(map);
    baseRef.current.setZIndex(1);

    labelsRef.current?.remove();
    labelsRef.current = null;
    if (basemap === 'satellite') {
      labelsRef.current = L.tileLayer(LABELS_OVERLAY, {
        opacity: 0.85,
        maxZoom: 18,
        updateWhenZooming: false,
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
      const chosen = governorate === name;
      poly.setStyle({
        color: chosen ? '#c9a24b' : '#2f5d43',
        weight: chosen ? 2.2 : 1,
        opacity: !governorate || chosen ? 0.7 : 0.2,
        fillColor: chosen ? '#c9a24b' : '#3d7a56',
        fillOpacity: chosen ? 0.14 : 0.04,
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
          paddingTopLeft: [offsetLeft + 40, offsetTop],
          paddingBottomRight: [offsetRight + 40, offsetBottom + 60],
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
    // Nudge the target so the pin lands in the middle of the *visible* slice,
    // not behind the side panel, the toolbar or the phone bottom sheet.
    const point = map
      .project([pin.lat, pin.lng], zoom)
      .subtract([(offsetLeft - offsetRight) / 2, (offsetTop - offsetBottom) / 2]);
    map.flyTo(map.unproject(point, zoom), zoom, { duration: 1.15, easeLinearity: 0.22 });
    // Only re-run when the selection (or an explicit focus request) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, focusToken]);

  return <div className="map-host" ref={hostRef} />;
}
