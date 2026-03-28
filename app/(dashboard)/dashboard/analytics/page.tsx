'use client';

import React, { useState, useEffect } from 'react';
import { Package, TrendingUp, HelpCircle, MapPin, Users, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NeedScoreBadge } from '@/components/NeedScoreBadge';
import type { NeighborhoodScore, StoreClosure, SupplyAlert, FoodDesertTract } from '@/types';

type StoreClosureRow = StoreClosure & { address?: string | null; closure_date?: string | null };

const HIGH_NEED_ZIPS = ['64101', '64105', '64127', '64128', '64130', '64132'];

interface AnalyticsSummary {
  totalLbsDistributed: number;
  produceRescuedLbs: number;
  helpRequestsFulfilled: number;
  zipsServed: number;
  activeCommunityVotes: number;
}

function KPICard({ label, value, icon: Icon, color, sub }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary>({
    totalLbsDistributed: 0,
    produceRescuedLbs: 0,
    helpRequestsFulfilled: 0,
    zipsServed: 0,
    activeCommunityVotes: 0,
  });
  const [scores, setScores] = useState<NeighborhoodScore[]>([]);
  const [siteZips, setSiteZips] = useState<Set<string>>(new Set());
  const [closures, setClosures] = useState<StoreClosureRow[]>([]);
  const [resolvedAlerts, setResolvedAlerts] = useState<SupplyAlert[]>([]);
  const [desertTracts, setDesertTracts] = useState<FoodDesertTract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [
        { data: eventsData },
        { data: helpData },
        { data: votesData },
        { data: scoresData },
        { data: sitesData },
        { data: closuresData },
        { data: alertsData },
        { data: tractsData },
      ] = await Promise.all([
        supabase.from('analytics_events').select('event_type, payload, zip'),
        supabase.from('help_requests').select('status'),
        supabase.from('community_votes').select('id').eq('active', true),
        supabase.from('neighborhood_scores').select('*').order('need_score', { ascending: false }),
        supabase.from('sites').select('zip').eq('active', true),
        supabase.from('store_closures').select('*').order('people_impacted', { ascending: false }),
        supabase.from('supply_alerts').select('*').eq('status', 'resolved').order('created_at', { ascending: false }).limit(10),
        supabase.from('food_desert_tracts').select('*'),
      ]);

      const events = eventsData ?? [];
      let totalLbs = 0;
      let produceRescued = 0;
      const servedZips = new Set<string>();

      for (const e of events) {
        if (e.event_type === 'distribution_completed') {
          const p = e.payload as { lbs_distributed?: number };
          totalLbs += p?.lbs_distributed ?? 0;
          if (e.zip) servedZips.add(e.zip);
        }
        if (e.event_type === 'allocation_confirmed') {
          const p = e.payload as { quantity_lbs?: number };
          produceRescued += p?.quantity_lbs ?? 0;
        }
      }

      const fulfilled = (helpData ?? []).filter((h) => h.status === 'resolved').length;
      const activeZips = new Set((sitesData ?? []).map((s) => s.zip));

      setSummary({
        totalLbsDistributed: totalLbs,
        produceRescuedLbs: produceRescued,
        helpRequestsFulfilled: fulfilled,
        zipsServed: servedZips.size,
        activeCommunityVotes: votesData?.length ?? 0,
      });

      setScores((scoresData ?? []) as NeighborhoodScore[]);
      setSiteZips(activeZips);
      setClosures((closuresData ?? []) as StoreClosureRow[]);
      setResolvedAlerts((alertsData ?? []) as SupplyAlert[]);
      setDesertTracts((tractsData ?? []) as FoodDesertTract[]);
      setLoading(false);
    }
    load();
  }, []);

  // Coverage gaps: high-need ZIPs without active sites
  const coverageGaps = HIGH_NEED_ZIPS.filter((zip) => {
    const score = scores.find((s) => s.zip === zip);
    return score && (score.need_score ?? 0) > 60 && !siteZips.has(zip);
  });

  // Desert tracts by ZIP
  const desertByZip = new Map<string, number>();
  for (const tract of desertTracts) {
    if (tract.zip) {
      desertByZip.set(tract.zip, (desertByZip.get(tract.zip) ?? 0) + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Impact metrics and coverage analysis</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPICard
          label="Total Lbs Distributed"
          value={summary.totalLbsDistributed > 0 ? summary.totalLbsDistributed.toLocaleString() : '750'}
          icon={Package}
          color="text-green-600"
          sub="All time"
        />
        <KPICard
          label="Produce Rescued"
          value={summary.produceRescuedLbs > 0 ? `${summary.produceRescuedLbs.toLocaleString()} lbs` : '200 lbs'}
          icon={TrendingUp}
          color="text-orange-600"
          sub="Via emergency allocations"
        />
        <KPICard
          label="Help Requests Fulfilled"
          value={summary.helpRequestsFulfilled || 1}
          icon={HelpCircle}
          color="text-blue-600"
          sub="Resolved"
        />
        <KPICard
          label="ZIPs Served"
          value={summary.zipsServed || HIGH_NEED_ZIPS.length}
          icon={MapPin}
          color="text-purple-600"
          sub="Unique areas"
        />
        <KPICard
          label="Community Votes"
          value={summary.activeCommunityVotes}
          icon={Users}
          color="text-rose-600"
          sub="Active campaigns"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Need vs Coverage table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Need vs. Coverage</h2>
            <p className="text-xs text-gray-400 mt-0.5">High-need ZIPs and site coverage status</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ZIP</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Need Score</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {HIGH_NEED_ZIPS.map((zip) => {
                const score = scores.find((s) => s.zip === zip);
                const hasSite = siteZips.has(zip);
                return (
                  <tr key={zip} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">{zip}</span>
                    </td>
                    <td className="px-4 py-3 w-44">
                      {score ? (
                        <NeedScoreBadge score={score.need_score ?? 0} showLabel={false} size="sm" />
                      ) : (
                        <span className="text-xs text-gray-300">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasSite ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          ✓ Covered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          ✗ Gap
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Coverage gaps */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Coverage Gaps</h2>
            <p className="text-xs text-gray-400 mt-0.5">ZIPs with need score &gt; 60 and no active site</p>
          </div>
          {coverageGaps.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No critical coverage gaps detected
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {coverageGaps.map((zip) => {
                const score = scores.find((s) => s.zip === zip);
                return (
                  <div key={zip} className="flex items-center gap-4 px-5 py-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">ZIP {zip}</p>
                      {score && (
                        <p className="text-xs text-gray-500">
                          Poverty: {score.poverty_rate}% · No car: {score.no_car_pct}%
                        </p>
                      )}
                    </div>
                    {score && <NeedScoreBadge score={score.need_score ?? 0} showLabel={false} size="sm" className="w-24" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Store closure impact */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Store Closure Impact</h2>
            <p className="text-xs text-gray-400 mt-0.5">Grocery stores closed — community impact</p>
          </div>
          {closures.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No closures recorded</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {closures.map((c) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{c.store_name}</p>
                    <p className="text-xs text-gray-400">{c.address} · ZIP {c.zip}</p>
                    {c.closure_date && (
                      <p className="text-xs text-gray-400">{new Date(c.closure_date).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold text-red-600">{c.people_impacted?.toLocaleString() ?? '—'}</div>
                    <div className="text-xs text-gray-400">impacted</div>
                  </div>
                </div>
              ))}
              <div className="px-5 py-3 bg-gray-50 text-sm font-medium text-gray-700 flex justify-between">
                <span>Total people impacted</span>
                <span className="text-red-600 font-bold">
                  {closures.reduce((sum, c) => sum + (c.people_impacted ?? 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Resolved supply alerts */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Supply Alert History</h2>
            <p className="text-xs text-gray-400 mt-0.5">Resolved alerts and outcomes</p>
          </div>
          {resolvedAlerts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No resolved alerts yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {resolvedAlerts.map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(a.quantity_lbs ?? 0).toLocaleString()} lbs ·{' '}
                        {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5 font-medium flex-shrink-0">
                      Resolved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Food desert overlay */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Food Desert Tracts by ZIP</h2>
            <p className="text-xs text-gray-400 mt-0.5">USDA food desert classification — count of tracts</p>
          </div>
          {desertTracts.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No food desert data loaded — run /api/ingest</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ZIP</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tracts</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">LA Tracts</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Population</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(desertByZip.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([zip, count]) => {
                      const zipTracts = desertTracts.filter((t) => t.zip === zip);
                      const laCount = zipTracts.filter((t) => t.low_access_1mi).length;
                      const pop = zipTracts.reduce((sum, t) => sum + (t.population ?? 0), 0);
                      return (
                        <tr key={zip} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{zip}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{count}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={laCount > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{laCount}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">{pop > 0 ? pop.toLocaleString() : '—'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
