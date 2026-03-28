import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchSupplyAlerts, hashString } from '@/lib/api/challenge';
import { extractAlertFields } from '@/lib/ai';
import { checkEscalations } from '@/lib/escalation';

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch live supply alerts
    const response = await fetchSupplyAlerts();
    const alerts = response.alerts;
    const newAlerts = [];

    for (const alert of alerts) {
      const alertHash = hashString(JSON.stringify(alert));

      // Check if we've already stored this alert
      const { data: existing } = await supabase
        .from('supply_alerts')
        .select('id')
        .eq('api_hash', alertHash)
        .maybeSingle();

      if (!existing) {
        // Extract structured fields from free-text description via Claude
        const fields = await extractAlertFields(alert.title, alert.description ?? null);

        const { data: inserted, error } = await supabase
          .from('supply_alerts')
          .insert({
            title: alert.title,
            description: alert.description ?? null,
            quantity_lbs: fields.quantity_lbs,
            perishability_hours: fields.perishability_hours,
            requires_cold: fields.requires_cold,
            status: 'open',
            impacted_zips: alert.impactedZips ?? null,
            api_hash: alertHash,
          })
          .select()
          .single();

        if (!error && inserted) {
          newAlerts.push(inserted);
        }
      }
    }

    // Run escalation check on every poll so perishable deadlines are caught
    const escalation = await checkEscalations();

    return NextResponse.json({
      success: true,
      polled_count: response.alerts.length,
      new_alerts: newAlerts,
      escalations: escalation,
    });
  } catch (error) {
    console.error('Supply alert poll error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
