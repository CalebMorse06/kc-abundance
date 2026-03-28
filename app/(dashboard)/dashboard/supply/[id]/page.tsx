'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, AlertTriangle, Snowflake, CheckCircle,
  Loader2, MapPin, ThumbsUp, Star, Sparkles, Link2, Copy, Check, Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SpoilageTimer } from '@/components/SpoilageTimer';
import { NeedScoreBadge } from '@/components/NeedScoreBadge';
import { Badge } from '@/components/ui/badge';
import { scoreSitesForBatch } from '@/lib/scoring/allocation';
import type { SupplyAlert, FoodBatch, Allocation, Site, NeighborhoodScore, AllocationCandidate } from '@/types';

type SiteTransitCache = { site_id: string; stops: { stop_id: string; name: string; routes: string[]; distance_m: number }[]; transit_data: unknown; fetched_at: string; expires_at: string };

export default function SupplyDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [alert, setAlert] = useState<SupplyAlert | null>(null);
  const [batches, setBatches] = useState<FoodBatch[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [candidates, setCandidates] = useState<AllocationCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<string | null>(null);
  const [dispatchLinks, setDispatchLinks] = useState<Record<string, string>>({}); // siteId → allocationId
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [escalatedPopup, setEscalatedPopup] = useState<{ id: string; zip: string | null; description: string | null; status: string } | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [batchForm, setBatchForm] = useState({ description: '', quantity_lbs: '', food_type: 'produce', requires_cold: false });

  const load = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const [{ data: alertData }, { data: batchesData }, { data: allocationsData }, { data: popupData }] = await Promise.all([
      supabase.from('supply_alerts').select('*').eq('id', id).single(),
      supabase.from('food_batches').select('*').eq('alert_id', id).order('created_at'),
      supabase.from('allocations').select('*, sites(*)').eq('batch_id', id),
      supabase.from('popup_events').select('id, zip, description, status').eq('triggered_by_alert_id', id).maybeSingle(),
    ]);

    setAlert(alertData as SupplyAlert);
    setBatches((batchesData ?? []) as FoodBatch[]);
    setAllocations((allocationsData ?? []) as unknown as Allocation[]);
    setEscalatedPopup(popupData ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const forceEscalate = async () => {
    setEscalating(true);
    try {
      const res = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: id }),
      });
      if (res.ok) await load();
    } finally {
      setEscalating(false);
    }
  };

  const createBatch = async () => {
    if (!batchForm.quantity_lbs || !batchForm.description) return;
    setCreatingBatch(true);
    const supabase = createClient();
    const spoilage_deadline = alert?.perishability_hours && alert?.created_at
      ? new Date(new Date(alert.created_at).getTime() + alert.perishability_hours * 3600000).toISOString()
      : null;
    await supabase.from('food_batches').insert({
      alert_id: id,
      description: batchForm.description,
      quantity_lbs: Number(batchForm.quantity_lbs),
      food_type: batchForm.food_type,
      requires_cold: batchForm.requires_cold,
      status: 'unallocated',
      perishability_hours: alert?.perishability_hours ?? null,
      spoilage_deadline,
    });
    setBatchForm({ description: '', quantity_lbs: '', food_type: 'produce', requires_cold: false });
    setShowCreateBatch(false);
    setCreatingBatch(false);
    await load();
  };

  const runAllocationScoring = async (batch: FoodBatch) => {
    setScoring(true);
    setSelectedBatchId(batch.id);
    const supabase = createClient();

    const [{ data: sites }, { data: scores }, { data: transit }] = await Promise.all([
      supabase.from('sites').select('*').eq('active', true),
      supabase.from('neighborhood_scores').select('*'),
      supabase.from('site_transit_cache').select('*'),
    ]);

    // Primary language by ZIP: use Hispanic% as proxy (>40% → es primary)
    const primaryLangByZip: Record<string, string> = {};
    for (const score of scores ?? []) {
      primaryLangByZip[score.zip] = score.hispanic_pct >= 40 ? 'es' : 'en';
    }

    const result = scoreSitesForBatch({
      batch,
      sites: (sites ?? []) as Site[],
      neighborhoodScores: (scores ?? []) as NeighborhoodScore[],
      transitCache: (transit ?? []) as SiteTransitCache[],
      primaryLanguageByZip: primaryLangByZip,
    });

    setCandidates(result);
    setScoring(false);
  };

  const confirmAllocation = async (candidate: AllocationCandidate, batch: FoodBatch) => {
    setConfirmingId(candidate.site.id);
    const supabase = createClient();

    const { data: inserted, error } = await supabase.from('allocations').insert({
      batch_id: batch.id,
      site_id: candidate.site.id,
      quantity_lbs: batch.quantity_lbs,
      status: 'confirmed',
      site_score: candidate.score,
      rationale: candidate.rationale,
    }).select('id').single();

    if (!error && inserted) {
      // Update batch status
      await supabase.from('food_batches').update({ status: 'allocated' }).eq('id', batch.id);
      // Log analytics event
      await supabase.from('analytics_events').insert({
        event_type: 'allocation_confirmed',
        zip: candidate.site.zip,
        site_id: candidate.site.id,
        quantity_lbs: batch.quantity_lbs,
        occurred_at: new Date().toISOString(),
        notes: `Allocated to ${candidate.site.name} — score ${candidate.score.toFixed(0)}`,
      });
      // Save dispatch link keyed by siteId
      setDispatchLinks((prev) => ({ ...prev, [candidate.site.id]: inserted.id }));
      await load();
      setCandidates([]);
    }
    setConfirmingId(null);
  };

  const copyDispatchLink = async (siteId: string) => {
    const allocId = dispatchLinks[siteId];
    if (!allocId) return;
    const url = `${window.location.origin}/dispatch/${allocId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(siteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const explainCandidate = async (candidate: AllocationCandidate, batch: FoodBatch) => {
    if (explanations[candidate.site.id]) return; // already fetched
    setExplaining(candidate.site.id);
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: candidate.site,
          score: candidate.neighborhood_score,
          rationale: candidate.rationale,
          batchDescription: `${batch.quantity_lbs.toLocaleString()} lbs${batch.requires_cold ? ' (cold storage required, perishable)' : ''} — ${batch.description}`,
        }),
      });
      const json = await res.json();
      setExplanations((prev) => ({ ...prev, [candidate.site.id]: json.explanation ?? 'No explanation returned.' }));
    } catch {
      setExplanations((prev) => ({ ...prev, [candidate.site.id]: 'Failed to generate explanation.' }));
    } finally {
      setExplaining(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--brand-teal)' }} />
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="p-6 text-center text-gray-500">
        Alert not found
        <Link href="/dashboard/supply" className="block mt-2 text-green-600 hover:underline text-sm">← Back</Link>
      </div>
    );
  }

  const spoilageDeadline = alert.perishability_hours && alert.created_at
    ? new Date(new Date(alert.created_at).getTime() + alert.perishability_hours * 3600000).toISOString()
    : null;

  const activeBatch = batches.find((b) => b.status === 'unallocated') ?? null;

  return (
    <div className="p-6 space-y-6">
      {/* Back */}
      <Link href="/dashboard/supply" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Supply Alerts
      </Link>

      {/* Alert header */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant={alert.status === 'open' ? 'destructive' : alert.status === 'in_progress' ? 'warning' : 'default'}>
                {alert.status.replace(/_/g, ' ').toUpperCase()}
              </Badge>
              {alert.requires_cold && (
                <Badge variant="info" className="flex items-center gap-1">
                  <Snowflake className="h-3 w-3" />
                  Cold Storage Required
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{alert.title}</h1>
            {alert.description && <p className="mt-2 text-gray-600">{alert.description}</p>}
            <div className="flex flex-wrap gap-4 mt-4 text-sm">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Package className="h-4 w-4 text-gray-400" />
                <span><strong>{(alert.quantity_lbs ?? 0).toLocaleString()}</strong> lbs total</span>
              </div>
              {alert.perishability_hours && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>{alert.perishability_hours}hr perishability window</span>
                </div>
              )}
              {alert.impacted_zips && alert.impacted_zips.length > 0 && (
                <div className="flex items-center gap-1.5 text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>Impacted ZIPs: {alert.impacted_zips.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Spoilage timer */}
          {spoilageDeadline && alert.status !== 'resolved' && (
            <SpoilageTimer deadline={spoilageDeadline} label="Spoils in" />
          )}
        </div>
      </div>

      {/* Food batches */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Food Batches</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
            {alert.status !== 'resolved' && (
              <button
                onClick={() => setShowCreateBatch(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                style={{ background: 'var(--brand-teal)' }}
              >
                <Package className="h-3.5 w-3.5" />
                {showCreateBatch ? 'Cancel' : 'Create Batch'}
              </button>
            )}
          </div>
        </div>

        {/* Inline create form */}
        {showCreateBatch && (
          <div className="p-5 border-b border-gray-100 bg-gray-50 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">New Batch</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={batchForm.description}
                  onChange={e => setBatchForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Fresh tomatoes and peppers"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Quantity (lbs)</label>
                <input
                  type="number"
                  value={batchForm.quantity_lbs}
                  onChange={e => setBatchForm(f => ({ ...f, quantity_lbs: e.target.value }))}
                  placeholder={String(alert.quantity_lbs ?? 0)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Food Type</label>
                <select
                  value={batchForm.food_type}
                  onChange={e => setBatchForm(f => ({ ...f, food_type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="produce">Produce</option>
                  <option value="dairy">Dairy</option>
                  <option value="dry_goods">Dry Goods</option>
                  <option value="prepared">Prepared Food</option>
                  <option value="protein">Protein</option>
                  <option value="bakery">Bakery</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="requires_cold"
                  checked={batchForm.requires_cold}
                  onChange={e => setBatchForm(f => ({ ...f, requires_cold: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-green-600"
                />
                <label htmlFor="requires_cold" className="text-sm text-gray-700 flex items-center gap-1">
                  <Snowflake className="h-3.5 w-3.5 text-blue-400" />
                  Requires Cold Storage
                </label>
              </div>
            </div>
            <button
              onClick={createBatch}
              disabled={creatingBatch || !batchForm.description || !batchForm.quantity_lbs}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ background: 'var(--brand-orange)' }}
            >
              {creatingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              {creatingBatch ? 'Creating…' : 'Create & Score'}
            </button>
          </div>
        )}

        {batches.length === 0 && !showCreateBatch ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No batches yet — click <strong>Create Batch</strong> above to split this alert into allocatable units.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {batches.map((batch) => (
              <div key={batch.id} className="p-5">
                <div className="flex items-start gap-3 justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={batch.status === 'allocated' ? 'default' : batch.status === 'spoiled' ? 'destructive' : 'secondary'}>
                        {batch.status}
                      </Badge>
                      {batch.requires_cold && <Badge variant="info">Cold Required</Badge>}
                    </div>
                    <p className="font-medium text-gray-900">{batch.description}</p>
                    <p className="text-sm text-gray-500 mt-1">{batch.quantity_lbs.toLocaleString()} lbs</p>
                  </div>
                  {batch.status === 'unallocated' && (
                    <button
                      onClick={() => runAllocationScoring(batch)}
                      disabled={scoring}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50" style={{ background: 'var(--brand-teal)' }}
                    >
                      {scoring && selectedBatchId === batch.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                      Score & Allocate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allocation candidates */}
      {candidates.length > 0 && activeBatch && (
        <div className="rounded-xl border border-green-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-green-100 bg-green-50">
            <h2 className="font-semibold text-gray-900">Allocation Recommendations</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ranked by composite score — click Confirm to allocate</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Site</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ZIP</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Need</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cold</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lang</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cap.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transit</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">AI</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 8).map((c, i) => (
                  <React.Fragment key={c.site.id}>
                    <tr className={`border-b border-gray-50 hover:bg-gray-50 ${i === 0 ? 'bg-green-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {i === 0 && <Star className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                          <div>
                            <p className="font-medium text-gray-900 text-xs">{c.site.name}</p>
                            <p className="text-xs text-gray-400">{c.site.type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{c.site.zip}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">{c.rationale.need}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${c.rationale.cold >= 100 ? 'text-green-600' : 'text-red-500'}`}>
                          {c.rationale.cold}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">{c.rationale.language}%</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">{c.rationale.capacity}%</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${c.rationale.transit >= 100 ? 'text-green-600' : 'text-gray-400'}`}>
                          {c.rationale.transit}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold" style={{ color: c.score >= 70 ? 'var(--brand-teal)' : c.score >= 50 ? 'var(--brand-orange)' : '#6B7280' }}>
                          {c.score.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => explainCandidate(c, activeBatch)}
                          disabled={explaining === c.site.id || !!explanations[c.site.id]}
                          title="Ask AI to explain this recommendation"
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${explanations[c.site.id] ? 'bg-purple-100 text-purple-700' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                        >
                          {explaining === c.site.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {explanations[c.site.id] ? 'Explained' : 'Explain'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => confirmAllocation(c, activeBatch)}
                          disabled={confirmingId === c.site.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50" style={{ background: 'var(--brand-teal)' }}
                        >
                          {confirmingId === c.site.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                          Confirm
                        </button>
                      </td>
                    </tr>
                    {explanations[c.site.id] && (
                      <tr className="bg-purple-50 border-b border-purple-100">
                        <td colSpan={10} className="px-4 py-2">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-purple-800 leading-relaxed">{explanations[c.site.id]}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {/* Rationale for top pick */}
          {candidates[0] && (
            <div className="px-5 py-3 bg-green-50 border-t border-green-100">
              <p className="text-xs text-green-800">
                <strong>Top recommendation:</strong> {candidates[0].rationale.explanation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmed allocations */}
      {allocations.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Confirmed Allocations</h2>
            <span className="text-xs text-gray-400">Share dispatch link with pantry manager</span>
          </div>
          <div className="divide-y divide-gray-50">
            {allocations.map((alloc) => {
              const dispatchAllocId = dispatchLinks[alloc.site_id] ?? (alloc.status === 'confirmed' || alloc.status === 'delivered' ? alloc.id : null);
              const isCopied = copiedId === alloc.site_id;
              return (
                <div key={alloc.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: alloc.status === 'delivered' ? '#2D8C7A20' : '#f0fdf4' }}>
                    <CheckCircle className="h-4 w-4" style={{ color: alloc.status === 'delivered' ? '#2D8C7A' : '#16a34a' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{alloc.site?.name ?? 'Unknown site'}</p>
                    <p className="text-xs text-gray-400">
                      {alloc.quantity_lbs.toLocaleString()} lbs ·{' '}
                      <span className={alloc.status === 'delivered' ? 'text-[#2D8C7A] font-semibold' : 'text-amber-600 font-medium'}>
                        {alloc.status === 'delivered' ? '✓ Delivered' : 'Awaiting delivery'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {alloc.site_score && (
                      <div className="text-right mr-2">
                        <div className="text-sm font-bold" style={{ color: 'var(--brand-teal)' }}>{alloc.site_score.toFixed(0)}</div>
                        <div className="text-xs text-gray-400">score</div>
                      </div>
                    )}
                    {dispatchAllocId && (
                      <button
                        onClick={() => copyDispatchLink(alloc.site_id)}
                        title="Copy dispatch link for pantry manager"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
                        style={isCopied
                          ? { background: '#2D8C7A20', color: '#2D8C7A', borderColor: '#2D8C7A40' }
                          : { background: '#fff', color: '#1B3A52', borderColor: '#d1d5db' }
                        }
                      >
                        {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {isCopied ? 'Copied!' : 'Dispatch Link'}
                        <Link2 className="h-3 w-3 opacity-50" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Escalation panel — auto-triggered or manual, for perishable batches */}
      {alert.perishability_hours && (() => {
        const impactedZips = alert.impacted_zips ?? [];
        const topCandidateZip = candidates.find(
          (c) => impactedZips.includes(c.site.zip ?? '')
        )?.site.zip ?? impactedZips[0];
        const targetZip = topCandidateZip ?? '64101';
        const isUrgent = alert.perishability_hours <= 24;

        // Hours until auto-escalation fires
        const hoursRemaining = spoilageDeadline
          ? (new Date(spoilageDeadline).getTime() - Date.now()) / 3600000
          : null;
        const escalationThreshold =
          alert.perishability_hours <= 12 ? alert.perishability_hours * 0.33 :
          alert.perishability_hours <= 24 ? 6 :
          alert.perishability_hours <= 48 ? 12 : 24;
        const hoursUntilEscalation = hoursRemaining !== null ? hoursRemaining - escalationThreshold : null;

        // ── Already escalated ──────────────────────────────────────────────
        if (escalatedPopup) {
          return (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h3 className="font-semibold text-green-900">Emergency Popup Activated</h3>
                    <span className="text-xs rounded-full px-2 py-0.5 bg-green-100 text-green-700 font-medium capitalize">
                      {escalatedPopup.status}
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    An emergency distribution event is active in ZIP <strong>{escalatedPopup.zip}</strong>.
                    Residents have been notified. The popup will run until the spoilage deadline.
                  </p>
                  {escalatedPopup.description && (
                    <p className="text-xs text-green-600 mt-2 italic line-clamp-2">
                      &ldquo;{escalatedPopup.description}&rdquo;
                    </p>
                  )}
                  <Link
                    href={`/community/${escalatedPopup.zip}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-green-700 hover:text-green-900 underline underline-offset-2"
                  >
                    View ZIP {escalatedPopup.zip} community page →
                  </Link>
                </div>
              </div>
            </div>
          );
        }

        if (alert.status !== 'open') return null;

        // ── Not yet escalated ──────────────────────────────────────────────
        return (
          <div className={`rounded-xl border p-5 ${isUrgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`} />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
                  <h3 className={`font-semibold ${isUrgent ? 'text-red-900' : 'text-amber-900'}`}>
                    {isUrgent ? 'Emergency Popup Required' : 'Same-Day Popup Recommended'}
                  </h3>
                  {hoursUntilEscalation !== null && hoursUntilEscalation > 0 && (
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      Auto-escalates in {hoursUntilEscalation < 1 ? '<1h' : `~${Math.round(hoursUntilEscalation)}h`}
                    </span>
                  )}
                  {hoursUntilEscalation !== null && hoursUntilEscalation <= 0 && (
                    <span className="text-xs text-red-500 flex-shrink-0 animate-pulse font-medium">
                      Escalation overdue — trigger manually
                    </span>
                  )}
                </div>
                <p className={`text-sm ${isUrgent ? 'text-red-700' : 'text-amber-700'}`}>
                  This batch {alert.requires_cold ? 'requires cold storage and ' : ''}spoils in under{' '}
                  {alert.perishability_hours} hours.
                  {impactedZips.length > 0 ? ` Priority impacted ZIPs: ${impactedZips.join(', ')}.` : ''}{' '}
                  An emergency popup in ZIP <strong>{targetZip}</strong> will notify residents immediately.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {impactedZips.slice(0, 3).map((z) => (
                    <Link
                      key={z}
                      href={`/community/${z}`}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        z === targetZip
                          ? isUrgent ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      ZIP {z} {z === targetZip ? '★' : ''}
                    </Link>
                  ))}
                  <button
                    onClick={forceEscalate}
                    disabled={escalating}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-all disabled:opacity-50 ml-auto shadow-sm hover:-translate-y-0.5"
                    style={{ background: isUrgent ? '#dc2626' : '#d97706' }}
                  >
                    {escalating
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Zap className="h-3.5 w-3.5" />}
                    {escalating ? 'Escalating…' : 'Escalate Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Need score for reference */}
      {candidates.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Site Need Scores Reference</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {candidates.slice(0, 4).map((c) => c.neighborhood_score && (
              <div key={c.site.id} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-medium text-gray-900">{c.site.name}</p>
                    <p className="text-xs text-gray-400">ZIP {c.site.zip}</p>
                  </div>
                </div>
                <NeedScoreBadge score={c.neighborhood_score.need_score ?? 0} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
