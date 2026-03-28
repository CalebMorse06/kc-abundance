'use client';

import { useState, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Site } from '@/types';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const KC_CENTER = { longitude: -94.5786, latitude: 39.0997, zoom: 11 };

const TYPE_COLOR: Record<string, string> = {
  food_bank:  '#16a34a',
  pantry:     '#2563eb',
  mobile:     '#d97706',
  shelter:    '#7c3aed',
  school:     '#0891b2',
  garden:     '#65a30d',
  popup:      '#db2777',
};

type SiteWithCoords = Site & { lat: number; lng: number };

export default function MapView({
  sites,
  onSelect,
}: {
  sites: Site[];
  onSelect: (id: string) => void;
}) {
  const [popupSite, setPopupSite] = useState<SiteWithCoords | null>(null);

  const located = sites.filter(
    (s): s is SiteWithCoords => s.lat !== null && s.lng !== null
  );

  const handleMarkerClick = useCallback(
    (site: SiteWithCoords, e: { originalEvent: MouseEvent }) => {
      e.originalEvent.stopPropagation();
      setPopupSite(site);
      onSelect(site.id);
    },
    [onSelect]
  );

  return (
    <Map
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={KC_CENTER}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      reuseMaps
    >
      <NavigationControl position="top-right" />

      {located.map((site) => (
        <Marker
          key={site.id}
          longitude={site.lng}
          latitude={site.lat}
          anchor="bottom"
          onClick={(e) => handleMarkerClick(site, e)}
        >
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md cursor-pointer hover:scale-125 transition-transform"
            style={{ backgroundColor: TYPE_COLOR[site.type] ?? '#16a34a' }}
            title={site.name}
          />
        </Marker>
      ))}

      {popupSite && (
        <Popup
          longitude={popupSite.lng}
          latitude={popupSite.lat}
          anchor="top"
          onClose={() => setPopupSite(null)}
          closeOnClick={false}
          maxWidth="220px"
        >
          <div className="p-1.5">
            <p className="font-semibold text-sm text-gray-900 leading-snug">{popupSite.name}</p>
            {popupSite.address && (
              <p className="text-xs text-gray-500 mt-0.5">{popupSite.address}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              {popupSite.type.replace('_', ' ')}
            </p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
