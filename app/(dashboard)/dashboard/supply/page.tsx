'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Package, Clock, CheckCircle, Loader2, Snowflake, Plus, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SpoilageTimerCompact } from '@/components/SpoilageTimer';
import { Badge } from '@/components/ui/badge';
import type { SupplyAlert } from '@/types';

const statusConfig = {
  open: { label: 'Open', variant: 'destructive' as const, icon: AlertTriangle },
  in_progress: { label: 'In Progress', variant: 'warning' as const, icon: Loader2 },
  resolved: { label: 'Resolved', variant: 'default' as const, icon: CheckCircle },
};

export default function SupplyAlertsPage() {
  const [alerts, setAlerts] = useState<SupplyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [escalatedAlertIds, setEscalatedAlertIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from('supply_alerts')
        .select('*')
        .order('created_at', { ascending: false });
      const alertList = (data ?? []) as SupplyAlert[];
      setAlerts(alertList);

      // Check which alerts have been escalated (have an active popup)
      if (alertList.length > 0) {
        const { data: popups } = await supabase
          .from('popup_events')
          .select('triggered_by_alert_id')
          .in('triggered_by_alert_id', alertList.map((a) => a.id))
          .not('triggered_by_alert_id', 'is', null);
        setEscalatedAlertIds(new Set((popups ?? []).map((p) => p.triggered_by_alert_id as string)));
      }
      setLoading(false);
    }

    // Poll the challenge API for new alerts on mount, then merge into DB results
    async function pollAndLoad() {
      try {
        const res = await fetch('/api/supply-alerts/poll');
        if (res.ok) {
          const polled = await res.json();
          if (polled.new_alerts?.length > 0) {
            // New alerts found — reload full list so order is correct
            await load();
            return;
          }
        }
      } catch {
        // Poll failed — fall through to normal load
      }
      await load();
    }

    pollAndLoad();

    // Re-poll every 60 seconds so urgent alerts (like 48hr produce) auto-surface
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/supply-alerts/poll');
        if (res.ok) {
          const polled = await res.json();
          if (polled.new_alerts?.length > 0) {
            setAlerts((prev) => {
              const existingIds = new Set(prev.map((a) => a.id));
              const genuinelyNew = (polled.new_alerts as SupplyAlert[]).filter(
                (a) => !existingIds.has(a.id)
              );
              return genuinelyNew.length > 0 ? [...genuinelyNew, ...prev] : prev;
            });
          }
        }
      } catch {
        // silent
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter);
  const openCount = alerts.filter((a) => a.status === 'open').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supply Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage incoming food supply alerts and produce rescue</p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--dash-sidebar-text)' }}>
          <span
            className="inline-block h-2 w-2 rounded-full animate-pulse"
            style={{ background: 'var(--brand-teal)' }}
          />
          Live — polls every 60s
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([['all', 'All'], ['open', 'Open'], ['in_progress', 'In Progress'], ['resolved', 'Resolved']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              filter === val
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
            {val === 'open' && openCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No alerts found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((alert) => {
            const config = statusConfig[alert.status];
            const Icon = config.icon;
            const spoilageDeadline = alert.perishability_hours && alert.created_at
              ? new Date(new Date(alert.created_at).getTime() + alert.perishability_hours * 3600000).toISOString()
              : null;
            const isPerishable = alert.perishability_hours && alert.perishability_hours <= 48;

            return (
              <Link
                key={alert.id}
                href={`/dashboard/dashboard/supply/${alert.id}`}
                className={`block rounded-xl border bg-white shadow-sm hover:shadow-md transition-all p-5 ${
                  alert.status === 'open' && isPerishable
                    ? 'border-red-200 hover:border-red-300'
                    : 'border-gray-200 hover:border-green-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Left icon */}
                  <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${
                    alert.status === 'open' ? 'bg-red-50' : alert.status === 'in_progress' ? 'bg-amber-50' : 'bg-green-50'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      alert.status === 'open' ? 'text-red-600' : alert.status === 'in_progress' ? 'text-amber-600' : 'text-green-600'
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant={config.variant}>{config.label}</Badge>
                      {alert.requires_cold && (
                        <Badge variant="info" className="flex items-center gap-1">
                          <Snowflake className="h-3 w-3" />
                          Cold Required
                        </Badge>
                      )}
                      {isPerishable && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Perishable
                        </Badge>
                      )}
                      {escalatedAlertIds.has(alert.id) && (
                        <Badge variant="default" className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                          <Zap className="h-3 w-3" />
                          Escalated
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">{alert.title}</h3>
                    {alert.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{alert.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Package className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{(alert.quantity_lbs ?? 0).toLocaleString()} lbs</span>
                      </div>
                      {alert.perishability_hours && (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>{alert.perishability_hours}hr perishability</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Right: spoilage timer */}
                  {spoilageDeadline && alert.status !== 'resolved' && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-gray-400 mb-1">Spoils in</p>
                      <SpoilageTimerCompact deadline={spoilageDeadline} />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick create batch placeholder */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <Plus className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Open a supply alert to create food batches and run allocation scoring</p>
      </div>
    </div>
  );
}
