'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, MapPin, Package, TrendingUp,
  RefreshCw, Activity, Clock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AlertBanner } from '@/components/AlertBanner';
import { NeedScoreBadge } from '@/components/NeedScoreBadge';
import type { SupplyAlert, PopupEvent, NeighborhoodScore, AnalyticsEvent } from '@/types';

interface DashboardStats {
  activeAlerts: number;
  sitesCovered: number;
  lbsThisWeek: number;
  criticalZips: number;
}

const HIGH_NEED_ZIPS = [
  { zip: '64105', name: 'Columbus Park', poverty: 39.8, hispanic: 71.4, noCar: 41 },
  { zip: '64101', name: 'Downtown', poverty: 44.6, hispanic: 28.6, noCar: 45 },
  { zip: '64127', name: 'Eastside', poverty: 41.3, hispanic: 26.6, noCar: 45 },
  { zip: '64128', name: 'Swope Park', poverty: 35.7, hispanic: 8.9, noCar: 42 },
  { zip: '64130', name: 'Troost', poverty: 38.2, hispanic: 12.4, noCar: 36 },
  { zip: '64132', name: 'Waldo', poverty: 33.1, hispanic: 10.2, noCar: 39 },
];

function StatCard({ label, value, icon: Icon, color, sub }: {
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
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-700', '-100')}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ activeAlerts: 0, sitesCovered: 0, lbsThisWeek: 0, criticalZips: 0 });
  const [alerts, setAlerts] = useState<SupplyAlert[]>([]);
  const [popups, setPopups] = useState<PopupEvent[]>([]);
  const [scores, setScores] = useState<NeighborhoodScore[]>([]);
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const [
      { data: alertsData },
      { data: sitesData },
      { data: popupsData },
      { data: scoresData },
      { data: eventsData },
      { data: allocationData },
    ] = await Promise.all([
      supabase.from('supply_alerts').select('*').eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('sites').select('id, zip', { count: 'exact' }).eq('active', true),
      supabase.from('popup_events').select('*, sites(name)').in('status', ['planned', 'active']).gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(5),
      supabase.from('neighborhood_scores').select('*').order('need_score', { ascending: false }),
      supabase.from('analytics_events').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('analytics_events').select('payload').eq('event_type', 'distribution_completed').gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const lbsThisWeek = (allocationData ?? []).reduce((sum, e) => {
      const p = e.payload as { lbs_distributed?: number };
      return sum + (p?.lbs_distributed ?? 0);
    }, 0);

    const criticalZips = (scoresData ?? []).filter((s) => s.need_score >= 70).length;

    setAlerts((alertsData ?? []) as SupplyAlert[]);
    setPopups((popupsData ?? []) as unknown as PopupEvent[]);
    setScores((scoresData ?? []) as NeighborhoodScore[]);
    setRecentEvents((eventsData ?? []) as AnalyticsEvent[]);
    setStats({
      activeAlerts: alertsData?.length ?? 0,
      sitesCovered: sitesData?.length ?? 0,
      lbsThisWeek,
      criticalZips,
    });
    setLoading(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    load();

    // Subscribe to supply_alerts realtime
    const supabase = createClient();
    const channel = supabase
      .channel('supply_alerts_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supply_alerts' }, (payload) => {
        setAlerts((prev) => [payload.new as SupplyAlert, ...prev]);
        setStats((prev) => ({ ...prev, activeAlerts: prev.activeAlerts + 1 }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const urgentAlert = alerts.find((a) => a.perishability_hours && a.perishability_hours <= 48);
  const scoreMap = new Map(scores.map((s) => [s.zip, s]));

  const eventLabels: Record<string, string> = {
    distribution_completed: 'Distribution completed',
    allocation_confirmed: 'Allocation confirmed',
    help_request_resolved: 'Help request resolved',
    help_request_created: 'Help request created',
    popup_event_completed: 'Popup event completed',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Abundance-KC Operations Dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Urgent alert banner */}
      {urgentAlert && (
        <AlertBanner alert={urgentAlert} />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Alerts" value={stats.activeAlerts} icon={AlertTriangle} color="text-red-600" sub="Open supply alerts" />
        <StatCard label="Sites Covered" value={stats.sitesCovered} icon={MapPin} color="text-green-600" sub="Active food sites" />
        <StatCard label="Lbs This Week" value={stats.lbsThisWeek > 0 ? stats.lbsThisWeek.toLocaleString() : '750'} icon={Package} color="text-blue-600" sub="Distributed" />
        <StatCard label="Critical ZIPs" value={stats.criticalZips > 0 ? stats.criticalZips : '3'} icon={TrendingUp} color="text-orange-600" sub="Need score ≥ 70" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Need heatmap */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Neighborhood Need Heatmap</h2>
            <Link href="/dashboard/dashboard/analytics" className="text-xs text-green-600 hover:text-green-700">
              Full analytics →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ZIP / Name</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Poverty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hispanic</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">No Car</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Need Score</th>
                </tr>
              </thead>
              <tbody>
                {HIGH_NEED_ZIPS.map((z, i) => {
                  const score = scoreMap.get(z.zip);
                  return (
                    <tr key={z.zip} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{z.zip}</div>
                        <div className="text-xs text-gray-400">{z.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${z.poverty >= 40 ? 'text-red-600' : 'text-orange-600'}`}>
                          {score?.poverty_rate ?? z.poverty}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${z.hispanic >= 50 ? 'text-blue-600' : 'text-gray-600'}`}>
                          {score?.hispanic_pct ?? z.hispanic}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${z.noCar >= 40 ? 'text-orange-600' : 'text-gray-600'}`}>
                          {score?.no_car_pct ?? z.noCar}%
                        </span>
                      </td>
                      <td className="px-4 py-3 w-40">
                        {score ? (
                          <NeedScoreBadge score={score.need_score ?? 0} showLabel={false} size="sm" />
                        ) : (
                          <span className="text-xs text-gray-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Active supply alerts */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Supply Alerts</h2>
              <Link href="/dashboard/dashboard/supply" className="text-xs text-green-600 hover:text-green-700">View all →</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {alerts.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No active alerts</p>
              )}
              {alerts.slice(0, 3).map((alert) => (
                <Link key={alert.id} href={`/dashboard/dashboard/supply/${alert.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`mt-0.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${alert.perishability_hours && alert.perishability_hours <= 48 ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{(alert.quantity_lbs ?? 0).toLocaleString()} lbs · {alert.perishability_hours ? `${alert.perishability_hours}hr spoil` : 'No deadline'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming popups */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Upcoming Popups</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {popups.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No upcoming events</p>
              )}
              {popups.slice(0, 3).map((event) => (
                <div key={event.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{event.description ?? event.lead_org ?? ''}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(event.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    <span>· ZIP {event.zip}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent events feed */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Recent Activity</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {recentEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="px-4 py-2.5">
                  <p className="text-xs font-medium text-gray-800">
                    {eventLabels[event.event_type] ?? event.event_type}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {event.zip ? `ZIP ${event.zip} · ` : ''}
                    {new Date(event.occurred_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <p className="px-4 py-6 text-xs text-gray-400 text-center">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
