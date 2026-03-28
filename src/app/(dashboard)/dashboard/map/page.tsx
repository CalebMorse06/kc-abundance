'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Layers, Route, RefreshCw, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Site, NeighborhoodScore } from '@/types';
import type { AllocationFlow } from '@/components/DistributionMap';

const DistributionMap = dynamic(() => import('@/components/DistributionMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center" style={{ background: '#111827' }}>
      <p className="text-gray-500 text-sm">Loading map…</p>
    </div>
  ),
});

function nearestFoodBank(
  dest: { lat: number; lng: number },
  banks: Array<Site & { lat: number; lng: number }>
): (Site & { lat: number; lng: number }) | null {
  if (banks.length === 0) return null;
  return banks.reduce((best, bank) => {
    const d  = Math.hypot(bank.lat - dest.lat, bank.lng - dest.lng);
    const bd = Math.hypot(best.lat - dest.lat, best.lng - dest.lng);
    return d < bd ? bank : best;
  });
}

type AllocRow = {
  id: string;
  quantity_lbs: number;
  status: string;
  sites: { id: string; name: string; lat: number | null; lng: number | null; type: string; zip: string | null } | null;
};

type DesertRow = { zip: string | null; food_desert: boolean };

export default function DistributionMapPage() {
  const [sites, setSites]       = useState<Site[]>([]);
  const [scores, setScores]     = useState<Map<string, NeighborhoodScore>>(new Map());
  const [allocs, setAllocs]     = useState<AllocRow[]>([]);
  const [desertRows, setDesertRows] = useState<DesertRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFlows,   setShowFlows]   = useState(true);
  const [showDesert,  setShowDesert]  = useState(true);
  const [showGaps,    setShowGaps]    = useState(true);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const [
      { data: sitesData },
      { data: scoresData },
      { data: allocData },
      { data: desertData },
    ] = await Promise.all([
      supabase.from('sites').select('*').eq('active', true),
      supabase.from('neighborhood_scores').select('*'),
      supabase
        .from('allocations')
        .select('id, quantity_lbs, status, sites(id, name, lat, lng, type, zip)')
        .in('status', ['confirmed', 'delivered']),
      supabase
        .from('food_desert_tracts')
        .select('zip, food_desert')
        .eq('food_desert', true),
    ]);

    setSites((sitesData ?? []) as Site[]);

    const scoreMap = new Map<string, NeighborhoodScore>();
    for (const s of scoresData ?? []) scoreMap.set(s.zip, s);
    setScores(scoreMap);

    setAllocs((allocData ?? []) as AllocRow[]);
    setDesertRows((desertData ?? []) as DesertRow[]);
    setLastRefresh(new Date());
    setLoading(false);
  }

  // Initial load
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: re-fetch when any allocation changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('dist-map-allocations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allocations' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ─────────────────────────────────────────────────────────────

  const flows = useMemo<AllocationFlow[]>(() => {
    const foodBanks = sites.filter(
      (s): s is Site & { lat: number; lng: number } =>
        s.type === 'food_bank' && s.lat !== null && s.lng !== null
    );
    return allocs.flatMap((alloc) => {
      const dest = alloc.sites;
      if (!dest?.lat || !dest?.lng) return [];
      const source = nearestFoodBank({ lat: dest.lat, lng: dest.lng }, foodBanks);
      if (!source) return [];
      return [{
        from: [source.lng, source.lat] as [number, number],
        to:   [dest.lng,   dest.lat]   as [number, number],
        quantity_lbs: alloc.quantity_lbs,
        dest_name: dest.name,
      }];
    });
  }, [sites, allocs]);

  const desertZips = useMemo(
    () => new Set(desertRows.map(r => r.zip).filter((z): z is string => !!z)),
    [desertRows]
  );

  const gapZips = useMemo(() => {
    const activeZips = new Set(sites.map(s => s.zip).filter(Boolean));
    return new Set(
      [...scores.entries()]
        .filter(([zip, s]) => (s.need_score ?? 0) >= 60 && !activeZips.has(zip))
        .map(([zip]) => zip)
    );
  }, [sites, scores]);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const totalLbs      = allocs.reduce((s, a) => s + (a.quantity_lbs ?? 0), 0);
  const criticalZips  = [...scores.values()].filter(s => (s.need_score ?? 0) >= 70).length;
  const foodBankCount = sites.filter(s => s.type === 'food_bank').length;
  const noFlows       = !loading && flows.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
        style={{ background: 'var(--brand-navy)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Distribution Map</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--dash-sidebar-text)' }}>
              Live allocations · Need heatmap · Coverage gaps
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4 ml-2">
            <Stat label="Lbs in flow"   value={totalLbs > 0 ? `${totalLbs.toLocaleString()} lbs` : '—'} />
            <Stat label="Active flows"  value={String(flows.length)} />
            <Stat label="Critical ZIPs" value={String(criticalZips)} danger={criticalZips > 0} />
            <Stat label="Coverage gaps" value={String(gapZips.size)} danger={gapZips.size > 0} />
            <Stat label="Food banks"    value={String(foodBankCount)} />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ToggleBtn active={showHeatmap} onClick={() => setShowHeatmap(v => !v)} label="Heat" icon={<Layers className="h-3.5 w-3.5" />} />
          <ToggleBtn active={showFlows}   onClick={() => setShowFlows(v => !v)}   label="Flows" icon={<Route className="h-3.5 w-3.5" />} />
          <ToggleBtn active={showDesert}  onClick={() => setShowDesert(v => !v)}  label="Desert" icon={<span className="text-xs font-bold">D</span>} />
          <ToggleBtn active={showGaps}    onClick={() => setShowGaps(v => !v)}    label="Gaps" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ml-1"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'var(--dash-sidebar-text)' }}
            title={`Refreshed ${lastRefresh.toLocaleTimeString()}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        <DistributionMap
          sites={sites}
          scores={scores}
          flows={flows}
          desertZips={desertZips}
          gapZips={gapZips}
          showHeatmap={showHeatmap}
          showFlows={showFlows}
          showDesert={showDesert}
          showGaps={showGaps}
        />

        {/* Empty state — no flows yet */}
        {noFlows && showFlows && (
          <div
            className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-xl px-5 py-3.5 text-center text-sm max-w-xs"
            style={{ background: 'rgba(15,20,40,0.9)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
          >
            <p className="text-white font-medium">No active allocation flows</p>
            <p className="text-gray-400 text-xs mt-1">
              Confirm allocations on a supply alert to see routes appear here.
            </p>
            <Link
              href="/dashboard/supply"
              className="inline-block mt-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--brand-orange)', color: 'var(--brand-navy)' }}
            >
              Go to Supply Alerts
            </Link>
          </div>
        )}

        {/* Legend */}
        <div
          className="absolute bottom-8 left-4 rounded-xl p-3 text-xs space-y-2.5"
          style={{ background: 'rgba(15,20,40,0.88)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {showHeatmap && (
            <LegendSection title="Need Score">
              {[
                { color: '#dc2626', label: 'Critical ≥ 70' },
                { color: '#ea580c', label: 'High 50–69' },
                { color: '#ca8a04', label: 'Medium 30–49' },
                { color: '#16a34a', label: 'Low < 30' },
              ].map(({ color, label }) => (
                <LegendRow key={label} color={color} label={label} />
              ))}
            </LegendSection>
          )}
          <LegendSection title="Sites">
            {[
              { color: '#16a34a', label: 'Food Bank', large: true },
              { color: '#2563eb', label: 'Pantry' },
              { color: '#d97706', label: 'Mobile' },
              { color: '#7c3aed', label: 'Shelter' },
              { color: '#db2777', label: 'Popup' },
            ].map(({ color, label, large }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`rounded-full border-2 border-white/30 flex-shrink-0 ${large ? 'w-4 h-4' : 'w-2.5 h-2.5'}`}
                  style={{ backgroundColor: color }} />
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
          </LegendSection>
          {showFlows && (
            <LegendSection title="Flows">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <div className="w-5 h-0.5 rounded" style={{ background: '#F5832A' }} />
                  <span style={{ color: '#F5832A', fontSize: 9 }}>▶</span>
                </div>
                <span className="text-gray-300">Allocation route</span>
              </div>
              <p className="text-gray-500 mt-0.5" style={{ fontSize: 10 }}>Width = quantity · Click to inspect</p>
            </LegendSection>
          )}
          {showDesert && (
            <LegendSection title="Overlays">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-red-500 bg-transparent" />
                <span className="text-gray-300">Food desert</span>
              </div>
            </LegendSection>
          )}
          {showGaps && (
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center w-5 h-5">
                <div className="absolute w-4 h-4 rounded-full bg-red-500/30 animate-ping" />
                <div className="w-2.5 h-2.5 rounded-full border-2 border-red-500" />
              </div>
              <span className="text-gray-300">Coverage gap</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-bold ${danger ? 'text-red-400' : 'text-white'}`}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--dash-sidebar-text)', fontSize: 10 }}>{label}</div>
    </div>
  );
}

function ToggleBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors"
      style={active
        ? { background: 'var(--brand-orange)', borderColor: 'var(--brand-orange)', color: 'var(--brand-navy)' }
        : { borderColor: 'rgba(255,255,255,0.15)', color: 'var(--dash-sidebar-text)' }}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function LegendSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-400 font-medium mb-1.5 uppercase tracking-wider" style={{ fontSize: 10 }}>{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full opacity-80" style={{ backgroundColor: color }} />
      <span className="text-gray-300">{label}</span>
    </div>
  );
}
