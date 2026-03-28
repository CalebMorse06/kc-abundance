/**
 * Deadline escalation engine.
 * Checks for unallocated perishable batches approaching spoilage and
 * auto-creates emergency popup events so residents are notified.
 */

import { createClient } from '@/lib/supabase/server';

export interface EscalationResult {
  escalated: number;
  skipped: number;
  popups_created: { alert_id: string; zip: string; alert_title: string }[];
  errors: string[];
}

/**
 * Hours remaining before escalation fires, based on total perishability window.
 * Rule: escalate when 25% of time is left (or at least 6h min / 24h max).
 */
export function escalationThresholdHours(perishabilityHours: number): number {
  if (perishabilityHours <= 12) return Math.max(2, perishabilityHours * 0.33);
  if (perishabilityHours <= 24) return 6;
  if (perishabilityHours <= 48) return 12;
  return 24;
}

export async function checkEscalations(): Promise<EscalationResult> {
  const supabase = await createClient();
  const result: EscalationResult = { escalated: 0, skipped: 0, popups_created: [], errors: [] };

  // Fetch unallocated batches that have a spoilage deadline set
  const { data: batches, error: batchErr } = await supabase
    .from('food_batches')
    .select('id, alert_id, quantity_lbs, requires_cold, perishability_hours, spoilage_deadline, description')
    .eq('status', 'unallocated')
    .not('spoilage_deadline', 'is', null)
    .not('alert_id', 'is', null);

  if (batchErr || !batches) {
    result.errors.push(`Batch query: ${batchErr?.message}`);
    return result;
  }

  if (batches.length === 0) return result;

  // Fetch the parent supply alerts for those batches
  const alertIds = [...new Set(batches.map((b) => b.alert_id as string))];
  const { data: alertRows } = await supabase
    .from('supply_alerts')
    .select('id, title, impacted_zips, status')
    .in('id', alertIds)
    .eq('status', 'open');

  const alertMap = new Map((alertRows ?? []).map((a) => [a.id, a]));

  // Neighborhood scores for ZIP prioritization (highest need first)
  const { data: scores } = await supabase
    .from('neighborhood_scores')
    .select('zip, need_score')
    .order('need_score', { ascending: false });

  const scoreByZip = new Map<string, number>(
    (scores ?? []).map((s) => [s.zip, s.need_score ?? 0])
  );

  const now = new Date();

  for (const batch of batches) {
    const alert = alertMap.get(batch.alert_id as string);
    if (!alert) { result.skipped++; continue; }
    if (!batch.perishability_hours || !batch.spoilage_deadline) { result.skipped++; continue; }

    const deadline = new Date(batch.spoilage_deadline);
    const hoursRemaining = (deadline.getTime() - now.getTime()) / 3600000;

    // Already spoiled — mark batch and skip
    if (hoursRemaining <= 0) {
      await supabase.from('food_batches').update({ status: 'spoiled' }).eq('id', batch.id);
      result.skipped++;
      continue;
    }

    const threshold = escalationThresholdHours(batch.perishability_hours);
    if (hoursRemaining > threshold) { result.skipped++; continue; }

    // Already escalated for this alert?
    const { data: existing } = await supabase
      .from('popup_events')
      .select('id')
      .eq('triggered_by_alert_id', alert.id)
      .maybeSingle();

    if (existing) { result.skipped++; continue; }

    // Pick highest-need impacted ZIP
    const impactedZips: string[] = alert.impacted_zips ?? [];
    let targetZip: string | null = null;

    if (impactedZips.length > 0) {
      targetZip = impactedZips.reduce((best, zip) =>
        (scoreByZip.get(zip) ?? 0) >= (scoreByZip.get(best) ?? 0) ? zip : best
      );
    } else {
      targetZip = scores?.[0]?.zip ?? null;
    }

    if (!targetZip) {
      result.errors.push(`No target ZIP for alert ${alert.id}`);
      continue;
    }

    const hoursLeft = Math.ceil(hoursRemaining);
    const coldNote = batch.requires_cold ? ' Refrigeration available on-site.' : '';

    const description =
      `EMERGENCY: ${batch.quantity_lbs.toLocaleString()} lbs of fresh produce available ` +
      `for immediate free distribution in ZIP ${targetZip}. Must reach families within ` +
      `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} before spoilage.${coldNote} ` +
      `No ID required.`;

    const description_es =
      `EMERGENCIA: ${batch.quantity_lbs.toLocaleString()} libras de productos frescos disponibles ` +
      `para distribución gratuita inmediata en el código postal ${targetZip}. Deben llegar a las ` +
      `familias en ${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''} antes de que se echen a perder.` +
      `${batch.requires_cold ? ' Refrigeración disponible en el lugar.' : ''} ` +
      `No se requiere identificación.`;

    const { error: popupErr } = await supabase.from('popup_events').insert({
      zip: targetZip,
      lead_org: 'Abundance-KC Emergency Response',
      description,
      description_es,
      scheduled_at: now.toISOString(),
      ends_at: batch.spoilage_deadline,
      status: 'active',
      triggered_by_alert_id: alert.id,
    });

    if (popupErr) {
      result.errors.push(`Popup for alert ${alert.id}: ${popupErr.message}`);
      continue;
    }

    // Analytics event
    await supabase.from('analytics_events').insert({
      event_type: 'escalation_triggered',
      zip: targetZip,
      site_id: null,
      quantity_lbs: batch.quantity_lbs,
      notes: `Auto-escalated: "${alert.title}" — ${hoursLeft}h remaining`,
      occurred_at: now.toISOString(),
    });

    result.escalated++;
    result.popups_created.push({ alert_id: alert.id, zip: targetZip, alert_title: alert.title });
  }

  return result;
}
