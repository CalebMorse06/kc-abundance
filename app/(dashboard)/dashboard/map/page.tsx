'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Layers, Route, RefreshCw, AlertTriangle, Sparkles, ArrowRight, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Site, NeighborhoodScore } from '@/types';
import type { AllocationFlow, ProposedFlow } from '@/components/DistributionMap';

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

  const [showPlan,      setShowPlan]      = useState(false);
  const [planLoading,   setPlanLoading]   = useState(false);
  const [planSummary,   setPlanSummary]   = useState('');
  const [planError,     setPlanError]     = useState<string | null>(null);
  const [proposedFlows, setProposedFlows] = useState<ProposedFlow[]>([]);

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

    setAllocs((allocData ?? []) as unknown as AllocRow[]);
    setDesertRows((desertData ?? []) as DesertRow[]);
    setLastRefresh(new Date());
    setLoading(false);
  }

  async function generatePlan() {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await fetch('/api/ai/allocation-plan');
      const data = await res.json() as {
        success: boolean;
        summary?: string;
        transfers?: Array<{
          from_site: { name: string; lat: number; lng: number };
          to_site:   { name: string; lat: number; lng: number };
          quantity_lbs: number;
          reason: string;
          priority: string;
        }>;
        error?: string;
      };
      if (data.success) {
        const flows: ProposedFlow[] = (data.transfers ?? []).map(t => ({
          from:         [t.from_site.lng, t.from_site.lat],
          to:           [t.to_site.lng,   t.to_site.lat],
          quantity_lbs: t.quantity_lbs,
          from_name:    t.from_site.name,
          to_name:      t.to_site.name,
          reason:       t.reason,
          priority:     t.priority,
        }));
        setProposedFlows(flows);
        setPlanSummary(data.summary ?? '');
      } else {
        setPlanError(data.error ?? 'Failed to generate plan.');
      }
    } catch {
      setPlanError('Network error — could not reach AI planner.');
    } finally {
      setPlanLoading(false);
    }
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
          <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.12)' }} />
          <button
            onClick={() => {
              const next = !showPlan;
              setShowPlan(next);
              if (next && proposedFlows.length === 0 && !planLoading) generatePlan();
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors"
            style={showPlan
              ? { background: '#06b6d4', borderColor: '#06b6d4', color: '#0f172a' }
              : { borderColor: 'rgba(6,182,212,0.4)', color: '#06b6d4' }}
          >
            {planLoading
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">AI Plan</span>
          </button>
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
          proposedFlows={proposedFlows}
          showProposed={showPlan}
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

        {/* AI Allocation Plan panel */}
        {showPlan && (
          <div
            className="absolute top-4 right-4 bottom-4 w-80 rounded-xl flex flex-col z-10 overflow-hidden"
            style={{ background: 'rgba(10,14,30,0.96)', border: '1px solid rgba(6,182,212,0.25)', backdropFilter: 'blur(12px)' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: '#06b6d4' }} />
                <span className="text-sm font-semibold text-white">AI Allocation Plan</span>
              </div>
              <button onClick={() => setShowPlan(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Loading state */}
            {planLoading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <RefreshCw className="h-6 w-6 animate-spin" style={{ color: '#06b6d4' }} />
                <p className="text-sm text-gray-300">Analyzing network…</p>
                <p className="text-xs text-gray-500">AI is reviewing site capacity, need scores, and neighborhood data to propose optimal transfers.</p>
              </div>
            )}

            {/* Error state */}
            {!planLoading && planError && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-red-400">{planError}</p>
                <button
                  onClick={generatePlan}
                  className="mt-2 rounded-lg px-4 py-2 text-xs font-medium"
                  style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Plan content */}
            {!planLoading && !planError && proposedFlows.length > 0 && (
              <>
                {/* Summary */}
                {planSummary && (
                  <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--dash-sidebar-text)' }}>{planSummary}</p>
                  </div>
                )}

                {/* Transfer list */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {proposedFlows.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(6,182,212,0.15)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <PlanPriorityBadge priority={f.priority} />
                        <span className="text-xs text-gray-400">{f.quantity_lbs.toLocaleString()} lbs</span>
                      </div>
                      <div className="flex items-start gap-1.5 mb-2">
                        <span className="text-xs font-medium text-white leading-snug flex-1 truncate">{f.from_name}</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: '#06b6d4' }} />
                        <span className="text-xs font-medium text-white leading-snug flex-1 truncate text-right">{f.to_name}</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(156,163,175,0.9)' }}>{f.reason}</p>
                    </div>
                  ))}
                </div>

                {/* Re-generate footer */}
                <div className="px-4 py-3 flex-shrink-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    onClick={generatePlan}
                    disabled={planLoading}
                    className="w-full rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                    style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Re-generate Plan
                  </button>
                </div>
              </>
            )}

            {/* Empty — no plan yet */}
            {!planLoading && !planError && proposedFlows.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <Sparkles className="h-7 w-7" style={{ color: '#06b6d4', opacity: 0.5 }} />
                <p className="text-sm text-gray-300">No plan generated yet</p>
                <button
                  onClick={generatePlan}
                  className="mt-1 rounded-lg px-4 py-2 text-xs font-medium"
                  style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
                >
                  Generate Plan
                </button>
              </div>
            )}
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
          {showPlan && proposedFlows.length > 0 && (
            <LegendSection title="AI Plan">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <div className="w-5 h-px" style={{ background: '#06b6d4', borderTop: '2px dashed #06b6d4' }} />
                  <span style={{ color: '#06b6d4', fontSize: 9 }}>▶</span>
                </div>
                <span className="text-gray-300">Proposed transfer</span>
              </div>
              <p className="text-gray-500 mt-0.5" style={{ fontSize: 10 }}>{proposedFlows.length} transfers · Click to inspect</p>
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

function PlanPriorityBadge({ priority }: { priority: string }) {
  const cfg: Record<string, { bg: string; label: string }> = {
    critical: { bg: '#dc2626', label: 'CRITICAL' },
    high:     { bg: '#ea580c', label: 'HIGH' },
    medium:   { bg: '#ca8a04', label: 'MEDIUM' },
  };
  const { bg, label } = cfg[priority] ?? { bg: '#6b7280', label: priority.toUpperCase() };
  return (
    <span
      className="rounded px-1.5 py-0.5 font-bold"
      style={{ background: `${bg}28`, color: bg, fontSize: 9 }}
    >
      {label}
    </span>
  );
}
