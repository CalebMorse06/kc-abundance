'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef, MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Site, NeighborhoodScore } from '@/types';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const KC_CENTER = { longitude: -94.5786, latitude: 39.0997, zoom: 11 };

const ZIP_CENTROIDS: Record<string, [number, number]> = {
  '64101': [-94.594, 39.103], '64105': [-94.586, 39.106],
  '64106': [-94.572, 39.106], '64108': [-94.586, 39.095],
  '64109': [-94.560, 39.082], '64110': [-94.551, 39.063],
  '64111': [-94.589, 39.071], '64112': [-94.598, 39.056],
  '64113': [-94.598, 39.037], '64114': [-94.598, 39.019],
  '64116': [-94.578, 39.136], '64117': [-94.554, 39.150],
  '64118': [-94.554, 39.182], '64119': [-94.513, 39.182],
  '64120': [-94.535, 39.109], '64123': [-94.529, 39.113],
  '64124': [-94.545, 39.107], '64125': [-94.514, 39.107],
  '64126': [-94.525, 39.090], '64127': [-94.527, 39.074],
  '64128': [-94.512, 39.060], '64129': [-94.511, 39.041],
  '64130': [-94.538, 39.034], '64131': [-94.598, 39.003],
  '64132': [-94.553, 39.018], '64133': [-94.485, 39.018],
  '64134': [-94.494, 38.998], '64136': [-94.462, 39.018],
  '64137': [-94.523, 38.983], '64138': [-94.486, 39.044],
  '64139': [-94.448, 39.044], '64145': [-94.623, 38.962],
  '64146': [-94.578, 38.948], '64147': [-94.534, 38.932],
  '64150': [-94.632, 39.155], '64151': [-94.633, 39.182],
  '64152': [-94.633, 39.208], '64154': [-94.578, 39.212],
  '64155': [-94.540, 39.212], '64157': [-94.470, 39.212],
};

const SITE_TYPE_COLOR: Record<string, string> = {
  food_bank: '#16a34a', pantry: '#2563eb', mobile: '#d97706',
  shelter: '#7c3aed', school: '#0891b2', garden: '#65a30d', popup: '#db2777',
};

// Cycling dash patterns — creates moving-line animation effect
const DASH_ARRAYS = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 1, 3, 3], [0, 2, 3, 2], [0, 3, 3, 1],
];

export interface AllocationFlow {
  from: [number, number];
  to:   [number, number];
  quantity_lbs: number;
  dest_name: string;
}

export interface ProposedFlow {
  from: [number, number];
  to:   [number, number];
  quantity_lbs: number;
  from_name: string;
  to_name: string;
  reason: string;
  priority: string;
}

interface Props {
  sites: Site[];
  scores: Map<string, NeighborhoodScore>;
  flows: AllocationFlow[];
  desertZips: Set<string>;
  gapZips: Set<string>;
  showHeatmap: boolean;
  showFlows: boolean;
  showDesert: boolean;
  showGaps: boolean;
  proposedFlows?: ProposedFlow[];
  showProposed?: boolean;
}

type SiteWithCoords = Site & { lat: number; lng: number };

type FlowPopup = { longitude: number; latitude: number; dest_name: string; quantity_lbs: number };

type ProposedPopup = { longitude: number; latitude: number; from_name: string; to_name: string; quantity_lbs: number; reason: string; priority: string };

export default function DistributionMap({
  sites, scores, flows, desertZips, gapZips,
  showHeatmap, showFlows, showDesert, showGaps,
  proposedFlows = [], showProposed = false,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [sitePopup, setSitePopup] = useState<SiteWithCoords | null>(null);
  const [flowPopup, setFlowPopup] = useState<FlowPopup | null>(null);
  const [proposedPopup, setProposedPopup] = useState<ProposedPopup | null>(null);

  const located = useMemo(
    () => sites.filter((s): s is SiteWithCoords => s.lat !== null && s.lng !== null),
    [sites]
  );

  // ── Auto-fit bounds to active flows ──────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || flows.length === 0) return;
    const map = mapRef.current;
    if (!map) return;
    const coords = flows.flatMap(f => [f.from, f.to]);
    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 120, duration: 1200, maxZoom: 13 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded]); // only on initial load — not every refresh

  // ── Animated dashes on flow lines ────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !showFlows || flows.length === 0) return;
    const rawMap = mapRef.current?.getMap();
    if (!rawMap) return;
    const map = rawMap;

    let step = 0;
    let timerId: ReturnType<typeof setTimeout>;

    function tick() {
      if (!map.getLayer('alloc-flows')) { timerId = setTimeout(tick, 100); return; }
      map.setPaintProperty('alloc-flows', 'line-dasharray', DASH_ARRAYS[step]);
      step = (step + 1) % DASH_ARRAYS.length;
      timerId = setTimeout(tick, 60);
    }
    tick();
    return () => clearTimeout(timerId);
  }, [mapLoaded, showFlows, flows.length]);

  // ── Click handler — flow lines ────────────────────────────────────────────────
  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!e.features || e.features.length === 0) {
      setFlowPopup(null);
      setProposedPopup(null);
      return;
    }
    const f = e.features[0];
    if (f.layer?.id === 'proposed-flows') {
      setProposedPopup({
        longitude:    e.lngLat.lng,
        latitude:     e.lngLat.lat,
        from_name:    f.properties?.from_name    ?? 'Source',
        to_name:      f.properties?.to_name      ?? 'Destination',
        quantity_lbs: f.properties?.quantity_lbs ?? 0,
        reason:       f.properties?.reason       ?? '',
        priority:     f.properties?.priority     ?? 'medium',
      });
      setFlowPopup(null);
      setSitePopup(null);
    } else {
      setFlowPopup({
        longitude:    e.lngLat.lng,
        latitude:     e.lngLat.lat,
        dest_name:    f.properties?.dest_name    ?? 'Unknown site',
        quantity_lbs: f.properties?.quantity_lbs ?? 0,
      });
      setProposedPopup(null);
      setSitePopup(null);
    }
  }, []);

  // ── Cursor pointer when hovering flows ───────────────────────────────────────
  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    const canvas = mapRef.current?.getMap().getCanvas();
    if (canvas) canvas.style.cursor = e.features?.length ? 'pointer' : '';
  }, []);

  // ── GeoJSON data ──────────────────────────────────────────────────────────────
  const heatmapGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: Object.entries(ZIP_CENTROIDS)
      .filter(([zip]) => scores.has(zip))
      .map(([zip, [lng, lat]]) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        properties: { zip, need_score: scores.get(zip)?.need_score ?? 0 },
      })),
  }), [scores]);

  const desertGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: Object.entries(ZIP_CENTROIDS)
      .filter(([zip]) => desertZips.has(zip))
      .map(([zip, [lng, lat]]) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        properties: { zip },
      })),
  }), [desertZips]);

  const flowsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: flows.map((f, i) => ({
      type: 'Feature' as const,
      id: i,
      geometry: { type: 'LineString' as const, coordinates: [f.from, f.to] },
      properties: {
        dest_name:    f.dest_name,
        quantity_lbs: f.quantity_lbs,
        line_width: Math.max(2, Math.min(7, Math.log((f.quantity_lbs / 100) + 1) * 2.5)),
      },
    })),
  }), [flows]);

  const gapZipEntries = useMemo(
    () => Object.entries(ZIP_CENTROIDS).filter(([zip]) => gapZips.has(zip)),
    [gapZips]
  );

  const proposedFlowsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: proposedFlows.map((f, i) => ({
      type: 'Feature' as const,
      id: i + 10000,
      geometry: { type: 'LineString' as const, coordinates: [f.from, f.to] },
      properties: {
        from_name:    f.from_name,
        to_name:      f.to_name,
        quantity_lbs: f.quantity_lbs,
        reason:       f.reason,
        priority:     f.priority,
        line_width: Math.max(2, Math.min(6, Math.log((f.quantity_lbs / 100) + 1) * 2)),
      },
    })),
  }), [proposedFlows]);

  // ── Layer styles ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatCircleLayer: any = {
    id: 'zip-need', type: 'circle',
    paint: {
      'circle-radius': 54, 'circle-blur': 0.9, 'circle-opacity': 0.28,
      'circle-color': ['step', ['get', 'need_score'],
        '#16a34a', 30, '#ca8a04', 50, '#ea580c', 70, '#dc2626'],
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const desertRingLayer: any = {
    id: 'food-desert', type: 'circle',
    paint: {
      'circle-radius': 32,
      'circle-color': 'transparent',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#dc2626',
      'circle-stroke-opacity': 0.55,
      'circle-opacity': 0,
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flowLineLayer: any = {
    id: 'alloc-flows', type: 'line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#F5832A', 'line-width': ['get', 'line_width'], 'line-opacity': 0.8 },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrowSymbolLayer: any = {
    id: 'alloc-arrows', type: 'symbol',
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 70,
      'text-field': '▶', 'text-size': 11,
      'text-allow-overlap': true, 'text-ignore-placement': true, 'text-keep-upright': false,
    },
    paint: { 'text-color': '#F5832A', 'text-opacity': 0.9 },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposedFlowLineLayer: any = {
    id: 'proposed-flows', type: 'line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#06b6d4',
      'line-width': ['get', 'line_width'],
      'line-opacity': 0.8,
      'line-dasharray': [5, 3],
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposedArrowLayer: any = {
    id: 'proposed-arrows', type: 'symbol',
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 80,
      'text-field': '▶', 'text-size': 10,
      'text-allow-overlap': true, 'text-ignore-placement': true, 'text-keep-upright': false,
    },
    paint: { 'text-color': '#06b6d4', 'text-opacity': 0.85 },
  };

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={KC_CENTER}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      reuseMaps
      interactiveLayerIds={[
        ...(showFlows && flows.length > 0 ? ['alloc-flows'] : []),
        ...(showProposed && proposedFlows.length > 0 ? ['proposed-flows'] : []),
      ]}
      onClick={handleMapClick}
      onMouseMove={handleMouseMove}
      onLoad={() => setMapLoaded(true)}
    >
      <NavigationControl position="top-right" />

      {/* ZIP need heatmap */}
      {showHeatmap && (
        <Source id="zip-need-src" type="geojson" data={heatmapGeoJSON}>
          <Layer {...heatCircleLayer} />
        </Source>
      )}

      {/* Food desert outlines */}
      {showDesert && (
        <Source id="desert-src" type="geojson" data={desertGeoJSON}>
          <Layer {...desertRingLayer} />
        </Source>
      )}

      {/* Allocation flow lines */}
      {showFlows && flows.length > 0 && (
        <Source id="flows-src" type="geojson" data={flowsGeoJSON}>
          <Layer {...flowLineLayer} />
          <Layer {...arrowSymbolLayer} />
        </Source>
      )}

      {/* Proposed allocation flow lines */}
      {showProposed && proposedFlows.length > 0 && (
        <Source id="proposed-flows-src" type="geojson" data={proposedFlowsGeoJSON}>
          <Layer {...proposedFlowLineLayer} />
          <Layer {...proposedArrowLayer} />
        </Source>
      )}

      {/* Coverage gap pulsing rings */}
      {showGaps && gapZipEntries.map(([zip, [lng, lat]]) => (
        <Marker key={`gap-${zip}`} longitude={lng} latitude={lat} anchor="center">
          <div className="relative flex items-center justify-center" title={`ZIP ${zip} — high need, no site`}>
            <div className="absolute w-10 h-10 rounded-full bg-red-500/25 animate-ping" />
            <div className="w-5 h-5 rounded-full border-2 border-red-500 bg-red-500/10" />
          </div>
        </Marker>
      ))}

      {/* Site markers */}
      {located.map((site) => (
        <Marker
          key={site.id}
          longitude={site.lng}
          latitude={site.lat}
          anchor="center"
          onClick={(e) => { e.originalEvent.stopPropagation(); setSitePopup(site); setFlowPopup(null); }}
        >
          <div
            className={`rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-125 ${
              site.type === 'food_bank' ? 'w-5 h-5' : 'w-3.5 h-3.5'
            }`}
            style={{ backgroundColor: SITE_TYPE_COLOR[site.type] ?? '#16a34a' }}
            title={site.name}
          />
        </Marker>
      ))}

      {/* Site popup */}
      {sitePopup && (
        <Popup longitude={sitePopup.lng} latitude={sitePopup.lat} anchor="top"
          onClose={() => setSitePopup(null)} closeOnClick={false} maxWidth="240px">
          <div className="p-2">
            <p className="font-semibold text-sm text-gray-900 leading-snug">{sitePopup.name}</p>
            {sitePopup.address && <p className="text-xs text-gray-500 mt-0.5">{sitePopup.address}</p>}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs capitalize rounded-full px-2 py-0.5 text-white"
                style={{ backgroundColor: SITE_TYPE_COLOR[sitePopup.type] ?? '#16a34a' }}>
                {sitePopup.type.replace('_', ' ')}
              </span>
              {sitePopup.capacity_lbs && (
                <span className="text-xs text-gray-400">{sitePopup.capacity_lbs.toLocaleString()} lbs cap</span>
              )}
              {sitePopup.zip && <span className="text-xs text-gray-400">ZIP {sitePopup.zip}</span>}
            </div>
          </div>
        </Popup>
      )}

      {/* Flow line popup */}
      {flowPopup && (
        <Popup longitude={flowPopup.longitude} latitude={flowPopup.latitude} anchor="bottom"
          onClose={() => setFlowPopup(null)} closeOnClick={false} maxWidth="200px">
          <div className="p-2">
            <p className="font-semibold text-sm text-gray-900 leading-snug">{flowPopup.dest_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {flowPopup.quantity_lbs.toLocaleString()} lbs allocated
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="w-3 h-0.5 rounded" style={{ background: '#F5832A' }} />
              <span className="text-xs" style={{ color: '#F5832A' }}>Active flow</span>
            </div>
          </div>
        </Popup>
      )}

      {/* Proposed flow popup */}
      {proposedPopup && (
        <Popup longitude={proposedPopup.longitude} latitude={proposedPopup.latitude} anchor="bottom"
          onClose={() => setProposedPopup(null)} closeOnClick={false} maxWidth="240px">
          <div className="p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ background: '#06b6d4', borderStyle: 'dashed' }} />
              <span className="text-xs font-semibold" style={{ color: '#06b6d4' }}>Proposed transfer</span>
            </div>
            <p className="text-xs font-medium text-gray-900 leading-snug">
              {proposedPopup.from_name} → {proposedPopup.to_name}
            </p>
            <p className="text-xs text-gray-500">{proposedPopup.quantity_lbs.toLocaleString()} lbs proposed</p>
            {proposedPopup.reason && (
              <p className="text-xs text-gray-600 leading-relaxed">{proposedPopup.reason}</p>
            )}
          </div>
        </Popup>
      )}
    </Map>
  );
}
