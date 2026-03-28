'use client';

import React, { useState, useEffect } from 'react';
import { Package, MapPin, Snowflake, CheckCircle, Clock, Loader2, AlertTriangle, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AbundanceSpinner } from '@/components/AbundanceSpinner';
import type { Site, FoodBatch, SupplyAlert } from '@/types';

interface DispatchAllocation {
  id: string;
  batch_id: string;
  site_id: string;
  quantity_lbs: number;
  status: string;
  site_score: number | null;
  created_at: string;
  sites: Site | null;
  food_batches: (FoodBatch & { supply_alerts: SupplyAlert | null }) | null;
}

export default function DispatchPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [alloc, setAlloc] = useState<DispatchAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    supabase
      .from('allocations')
      .select('*, sites(*), food_batches(*, supply_alerts(*))')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Dispatch record not found.');
        } else {
          setAlloc(data as unknown as DispatchAllocation);
          setConfirmed(data.status === 'delivered');
        }
        setLoading(false);
      });
  }, [id]);

  const handleConfirm = async () => {
    if (!id || confirming || confirmed) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/dispatch/${id}/confirm`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setConfirmed(true);
        setAlloc((prev) => prev ? { ...prev, status: 'delivered' } : prev);
      } else {
        setError('Could not confirm. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8F6F1' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--brand-teal, #2D8C7A)' }} />
      </div>
    );
  }

  if (error || !alloc) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F8F6F1' }}>
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800">{error ?? 'Dispatch record not found.'}</p>
          <p className="text-sm text-gray-500 mt-1">Check the link and try again.</p>
        </div>
      </div>
    );
  }

  const site = alloc.sites;
  const batch = alloc.food_batches;
  const alert = batch?.supply_alerts;
  const allocatedAt = new Date(alloc.created_at).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: 'America/Chicago',
  });

  return (
    <div className="min-h-screen py-10 px-4 flex flex-col items-center" style={{ background: '#F8F6F1' }}>
      <div className="w-full max-w-lg space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <AbundanceSpinner size={32} />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#2D8C7A' }}>Abundance-KC</p>
            <p className="text-xs text-gray-400">Food Distribution Network</p>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3" style={{ background: '#0F1F2E' }}>
            <Truck className="h-5 w-5 text-white/70 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Delivery Notice</p>
              <p className="text-sm font-bold text-white">Incoming Food Shipment</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Destination */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Destination</p>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#2D8C7A] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-gray-900">{site?.name ?? 'Unknown Site'}</p>
                  <p className="text-sm text-gray-500">{site?.address ?? ''}</p>
                  {site?.zip && <p className="text-sm text-gray-400">Kansas City, MO {site.zip}</p>}
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* What's coming */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">What&apos;s Coming</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                {alert?.title && (
                  <p className="text-sm font-medium text-gray-800">{alert.title}</p>
                )}
                {batch?.description && (
                  <p className="text-sm text-gray-600">{batch.description}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900">
                      {alloc.quantity_lbs.toLocaleString()} lbs
                    </span>
                  </div>
                  {batch?.requires_cold && (
                    <div className="flex items-center gap-1.5">
                      <Snowflake className="h-4 w-4 text-sky-500" />
                      <span className="text-sm font-medium text-sky-700">Cold storage required</span>
                    </div>
                  )}
                  {batch?.perishability_hours && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <span className="text-sm text-amber-700">Use within {batch.perishability_hours}hr</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* Allocated at */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Dispatch issued</span>
              <span className="font-medium text-gray-700">{allocatedAt}</span>
            </div>

            {/* Score context */}
            {alloc.site_score && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Match score</span>
                <span className="font-bold" style={{ color: alloc.site_score >= 70 ? '#2D8C7A' : '#F5A623' }}>
                  {alloc.site_score.toFixed(0)}/100
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Confirm button */}
        {!confirmed ? (
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full rounded-2xl py-4 text-base font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
            style={{ background: '#F5A623', color: '#1B3A52' }}
          >
            {confirming ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Confirming…</>
            ) : (
              <><CheckCircle className="h-5 w-5" /> Confirm Receipt / Confirmar recibo</>
            )}
          </button>
        ) : (
          <div
            className="w-full rounded-2xl py-4 text-base font-bold flex items-center justify-center gap-2"
            style={{ background: '#2D8C7A', color: '#fff' }}
          >
            <CheckCircle className="h-5 w-5" />
            Delivery Confirmed — ¡Entrega confirmada!
          </div>
        )}

        {confirmed && (
          <p className="text-center text-xs text-gray-400">
            This confirmation has been logged. The Abundance-KC team has been notified.
          </p>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 pt-2">
          Abundance-KC · Kansas City Food Distribution Network · abundancekc.org
        </p>
      </div>
    </div>
  );
}
