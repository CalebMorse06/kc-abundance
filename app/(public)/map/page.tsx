'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, MapIcon, List, SlidersHorizontal, X } from 'lucide-react';
import { SiteCard } from '@/components/SiteCard';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n';
import type { Site, NeighborhoodScore } from '@/types';

type SiteTransitCache = { site_id: string; stops: { stop_id: string; name: string; routes: string[]; distance_m: number }[]; transit_data: unknown; fetched_at: string; expires_at: string };

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const MapComponent = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-gray-100 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading map…</p>
    </div>
  ),
});

function SiteListView({
  sites,
  scores,
  transitMap,
  onSelect,
  selectedId,
  isEs,
}: {
  sites: Site[];
  scores: Map<string, NeighborhoodScore>;
  transitMap: Map<string, SiteTransitCache>;
  onSelect: (id: string) => void;
  selectedId: string | null;
  isEs: boolean;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, Site[]>();
    for (const site of sites) {
      const zipKey = site.zip ?? '';
      if (!groups.has(zipKey)) groups.set(zipKey, []);
      groups.get(zipKey)!.push(site);
    }
    return groups;
  }, [sites]);

  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Filter className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">{isEs ? 'No hay sitios que coincidan' : 'No sites match your filters'}</p>
        <p className="text-sm mt-1">{isEs ? 'Intenta cambiar los filtros' : 'Try adjusting your filters'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {Array.from(grouped.entries()).map(([zip, zipSites]) => (
        <div key={zip}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">ZIP {zip}</span>
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">{zipSites.length} site{zipSites.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-3">
            {zipSites.map((site) => (
              <div
                key={site.id}
                onClick={() => onSelect(site.id)}
                className={selectedId === site.id ? 'ring-2 ring-[#2D8C7A] rounded-xl' : ''}
              >
                <SiteCard
                  site={site}
                  neighborhoodScore={scores.get(site.zip ?? '')}
                  transitAccessible={(transitMap.get(site.id)?.stops?.length ?? 0) > 0}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MapPageContent() {
  const searchParams = useSearchParams();
  const initialZip = searchParams.get('zip') ?? '';
  const { lang } = useLanguage();
  const isEs = lang === 'es';

  const [sites, setSites] = useState<Site[]>([]);
  const [scores, setScores] = useState<Map<string, NeighborhoodScore>>(new Map());
  const [transitMap, setTransitMap] = useState<Map<string, SiteTransitCache>>(new Map());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchZip, setSearchZip] = useState(initialZip);

  // Filters
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [filterSpanish, setFilterSpanish] = useState(false);
  const [filterNoId, setFilterNoId] = useState(false);
  const [filterFresh, setFilterFresh] = useState(false);
  const [filterBus, setFilterBus] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      setLoading(true);
      const [{ data: sitesData }, { data: scoresData }, { data: transitData }] = await Promise.all([
        supabase.from('sites').select('*').eq('active', true).order('name'),
        supabase.from('neighborhood_scores').select('*'),
        supabase.from('site_transit_cache').select('*'),
      ]);

      // If no sites in DB yet, trigger ingest and reload
      if (!sitesData || sitesData.length === 0) {
        try {
          await fetch('/api/ingest', { method: 'POST' });
          const { data: reloaded } = await supabase.from('sites').select('*').eq('active', true).order('name');
          setSites(reloaded ?? []);
        } catch {
          setSites([]);
        }
      } else {
        setSites(sitesData);
      }

      const scoreMap = new Map<string, NeighborhoodScore>();
      for (const s of scoresData ?? []) scoreMap.set(s.zip, s);
      setScores(scoreMap);

      const tMap = new Map<string, SiteTransitCache>();
      for (const t of transitData ?? []) tMap.set(t.site_id, t);
      setTransitMap(tMap);
      setLoading(false);
    }
    load();
  }, []);

  const isOpenNow = (site: Site): boolean => {
    if (!site.hours_parsed || site.hours_parsed.length === 0) return false;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return site.hours_parsed.some((h) => h.day.toLowerCase() === todayName && currentTime >= h.open && currentTime <= h.close);
  };

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (searchZip && !(site.zip ?? '').includes(searchZip)) return false;
      if (filterOpenNow && !isOpenNow(site)) return false;
      if (filterSpanish && !site.languages.includes('es')) return false;
      if (filterNoId && site.id_required) return false;
      if (filterFresh && site.cold_storage_type === 'none') return false;
      if (filterBus && (transitMap.get(site.id)?.stops?.length ?? 0) === 0) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites, searchZip, filterOpenNow, filterSpanish, filterNoId, filterFresh, filterBus, transitMap]);

  const activeFilterCount = [filterOpenNow, filterSpanish, filterNoId, filterFresh, filterBus].filter(Boolean).length;

  const FilterToggle = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
        active
          ? 'bg-[#2D8C7A] text-white border-[#2D8C7A]'
          : 'bg-white text-gray-600 border-gray-200 hover:border-[#2D8C7A] hover:text-[#2D8C7A]'
      }`}
    >
      {active && <X className="h-3 w-3 mr-1" />}
      {label}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left panel — filters + list */}
      <div className="flex flex-col w-full lg:w-[420px] xl:w-[480px] lg:flex-shrink-0 border-r border-gray-200 bg-white">
        {/* Search & filters header */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={isEs ? 'Buscar por código postal...' : 'Search by ZIP code...'}
              value={searchZip}
              onChange={(e) => setSearchZip(e.target.value.replace(/\D/, '').slice(0, 5))}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D8C7A] focus:border-transparent placeholder:text-gray-400"
            />
          </div>

          {/* Filter toggle button */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#1B3A52]"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {isEs ? 'Filtros' : 'Filters'}
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2D8C7A] text-xs text-white font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <span>{filteredSites.length} {isEs ? 'sitio' : 'site'}{filteredSites.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Filter chips */}
          {showFilters && (
            <div className="flex flex-wrap gap-2">
              <FilterToggle label={isEs ? 'Abierto Ahora' : 'Open Now'} active={filterOpenNow} onClick={() => setFilterOpenNow(!filterOpenNow)} />
              <FilterToggle label="Spanish / Español" active={filterSpanish} onClick={() => setFilterSpanish(!filterSpanish)} />
              <FilterToggle label={isEs ? 'Sin ID Requerida' : 'No ID Required'} active={filterNoId} onClick={() => setFilterNoId(!filterNoId)} />
              <FilterToggle label={isEs ? 'Productos Frescos' : 'Fresh Produce'} active={filterFresh} onClick={() => setFilterFresh(!filterFresh)} />
              <FilterToggle label={isEs ? 'Accesible en Autobús' : 'Bus Accessible'} active={filterBus} onClick={() => setFilterBus(!filterBus)} />
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setFilterOpenNow(false);
                    setFilterSpanish(false);
                    setFilterNoId(false);
                    setFilterFresh(false);
                    setFilterBus(false);
                  }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1.5"
                >
                  {isEs ? 'Limpiar todo' : 'Clear all'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* View toggle (mobile) */}
        <div className="flex lg:hidden border-b border-gray-100">
          <button
            onClick={() => setView('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              view === 'list' ? 'text-[#2D8C7A] border-b-2 border-[#2D8C7A]' : 'text-gray-500'
            }`}
          >
            <List className="h-4 w-4" /> {isEs ? 'Lista' : 'List'}
          </button>
          {MAPBOX_TOKEN && (
            <button
              onClick={() => setView('map')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
                view === 'map' ? 'text-[#2D8C7A] border-b-2 border-[#2D8C7A]' : 'text-gray-500'
              }`}
            >
              <MapIcon className="h-4 w-4" /> {isEs ? 'Mapa' : 'Map'}
            </button>
          )}
        </div>

        {/* Site list */}
        <div className={`flex-1 overflow-y-auto ${view === 'map' ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <SiteListView
              sites={filteredSites}
              scores={scores}
              transitMap={transitMap}
              onSelect={setSelectedId}
              selectedId={selectedId}
              isEs={isEs}
            />
          )}
        </div>
      </div>

      {/* Right panel — map */}
      <div className={`flex-1 ${view === 'list' ? 'hidden lg:block' : ''}`}>
        {MAPBOX_TOKEN ? (
          <div className="h-full">
            <MapComponent sites={filteredSites} onSelect={setSelectedId} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#E8F5F2] to-white p-8">
            <div className="max-w-md text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2D8C7A]/10 mb-6">
                <MapIcon className="h-8 w-8 text-[#2D8C7A]" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Interactive Map</h2>
              <p className="text-gray-500 text-sm mb-4">
                An interactive map will appear here once a Mapbox token is configured.
                For now, use the list view on the left to find sites by ZIP code.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {['64101', '64105', '64127', '64128', '64130', '64132'].map((zip) => (
                  <button
                    key={zip}
                    onClick={() => setSearchZip(zip)}
                    className={`rounded-lg px-3 py-2 border transition-colors ${
                      searchZip === zip
                        ? 'bg-[#2D8C7A] text-white border-[#2D8C7A]'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-[#2D8C7A]'
                    }`}
                  >
                    {zip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-gray-400">Loading...</div></div>}>
      <MapPageContent />
    </Suspense>
  );
}
