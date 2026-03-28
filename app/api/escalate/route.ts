import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkEscalations, escalationThresholdHours } from '@/lib/escalation';

/** POST — manually force escalation for a specific alert */
export async function POST(req: Request) {
  try {
    const { alert_id } = await req.json() as { alert_id?: string };
    const supabase = await createClient();

    if (alert_id) {
      // Force-escalate a specific alert: temporarily zero out the threshold
      // by passing the batch directly to the escalation engine after
      // checking it isn't already escalated.
      const { data: existing } = await supabase
        .from('popup_events')
        .select('id, zip, status, description')
        .eq('triggered_by_alert_id', alert_id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, already_escalated: true, popup: existing });
      }

      // Fetch the batch and alert
      const [{ data: batches }, { data: alert }, { data: scores }] = await Promise.all([
        supabase
          .from('food_batches')
          .select('id, quantity_lbs, requires_cold, perishability_hours, spoilage_deadline')
          .eq('alert_id', alert_id)
          .eq('status', 'unallocated')
          .limit(1),
        supabase.from('supply_alerts').select('id, title, impacted_zips').eq('id', alert_id).single(),
        supabase.from('neighborhood_scores').select('zip, need_score').order('need_score', { ascending: false }),
      ]);

      if (!alert) {
        return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
      }

      // Use batch data if available, otherwise fall back to alert-level fields
      const batch = batches?.[0] ?? null;
      const quantityLbs: number = batch?.quantity_lbs ?? (alert as unknown as Record<string, number>).quantity_lbs ?? 0;
      const perishabilityHours: number = batch?.perishability_hours ?? (alert as unknown as Record<string, number>).perishability_hours ?? 48;
      const requiresCold: boolean = batch?.requires_cold ?? (alert as unknown as Record<string, boolean>).requires_cold ?? false;

      const scoreByZip = new Map<string, number>((scores ?? []).map((s) => [s.zip, s.need_score ?? 0]));
      const impactedZips: string[] = alert.impacted_zips ?? [];

      const targetZip = impactedZips.length > 0
        ? impactedZips.reduce((best, zip) =>
            (scoreByZip.get(zip) ?? 0) >= (scoreByZip.get(best) ?? 0) ? zip : best
          )
        : scores?.[0]?.zip ?? null;

      if (!targetZip) {
        return NextResponse.json({ success: false, error: 'No target ZIP available' }, { status: 400 });
      }

      const now = new Date();
      const deadline = batch?.spoilage_deadline ? new Date(batch.spoilage_deadline) : null;
      const hoursLeft = deadline ? Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / 3600000)) : perishabilityHours;
      const coldNote = requiresCold ? ' Refrigeration available on-site.' : '';

      const description =
        `EMERGENCY: ${quantityLbs.toLocaleString()} lbs of fresh produce available ` +
        `for immediate free distribution in ZIP ${targetZip}. Must reach families within ` +
        `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''} before spoilage.${coldNote} No ID required.`;

      const description_es =
        `EMERGENCIA: ${quantityLbs.toLocaleString()} libras de productos frescos disponibles ` +
        `para distribución gratuita inmediata en el código postal ${targetZip}. Deben llegar a las ` +
        `familias en ${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''}.` +
        `${requiresCold ? ' Refrigeración disponible.' : ''} No se requiere identificación.`;

      const { data: popup, error: popupErr } = await supabase
        .from('popup_events')
        .insert({
          zip: targetZip,
          lead_org: 'Abundance-KC Emergency Response',
          description,
          description_es,
          scheduled_at: now.toISOString(),
          ends_at: batch.spoilage_deadline ?? new Date(now.getTime() + hoursLeft * 3600000).toISOString(),
          status: 'active',
          triggered_by_alert_id: alert_id,
        })
        .select()
        .single();

      if (popupErr) {
        return NextResponse.json({ success: false, error: popupErr.message }, { status: 500 });
      }

      await supabase.from('analytics_events').insert({
        event_type: 'escalation_triggered',
        zip: targetZip,
        quantity_lbs: quantityLbs,
        notes: `Force-escalated by operator: "${alert.title}"`,
        occurred_at: now.toISOString(),
      });

      return NextResponse.json({ success: true, popup, zip: targetZip });
    }

    // No alert_id — run full escalation sweep
    const result = await checkEscalations();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Escalate error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

/** GET — return escalation status for all open perishable batches */
export async function GET() {
  try {
    const supabase = await createClient();
    const now = new Date();

    const { data: batches } = await supabase
      .from('food_batches')
      .select('id, alert_id, perishability_hours, spoilage_deadline, status')
      .eq('status', 'unallocated')
      .not('perishability_hours', 'is', null);

    const summary = (batches ?? []).map((b) => {
      const deadline = b.spoilage_deadline ? new Date(b.spoilage_deadline) : null;
      const hoursRemaining = deadline ? (deadline.getTime() - now.getTime()) / 3600000 : null;
      const threshold = b.perishability_hours ? escalationThresholdHours(b.perishability_hours) : null;
      const willEscalateIn = hoursRemaining && threshold ? hoursRemaining - threshold : null;
      return {
        batch_id: b.id,
        alert_id: b.alert_id,
        hours_remaining: hoursRemaining ? Math.round(hoursRemaining * 10) / 10 : null,
        escalates_in_hours: willEscalateIn ? Math.round(willEscalateIn * 10) / 10 : null,
        overdue: willEscalateIn !== null && willEscalateIn <= 0,
      };
    });

    return NextResponse.json({ success: true, batches: summary });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
