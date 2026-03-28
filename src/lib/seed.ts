/**
 * Seed function for FoodBridge KC demo state.
 */

import { createClient } from '@/lib/supabase/server';

export async function runSeed(): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  try {
    // Profiles are skipped in seed — they require auth.users FK.
    // Create internal users via Supabase Auth dashboard or /api/create-user.

    // ── 2. Supply alert ───────────────────────────────────────────────────────
    const alertDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: existingAlert } = await supabase
      .from('supply_alerts')
      .select('id')
      .eq('title', 'USDA Emergency Produce Donation — 1,000 lbs')
      .maybeSingle();

    let alertId: string;

    if (existingAlert) {
      alertId = existingAlert.id;
    } else {
      const { data: newAlert, error: alertError } = await supabase
        .from('supply_alerts')
        .insert({
          source: 'seeded',
          title: 'USDA Emergency Produce Donation — 1,000 lbs',
          description:
            'Emergency donation of fresh produce from USDA surplus. Includes strawberries, tomatoes, and mixed greens. Requires cold storage. Coordinate immediate distribution.',
          quantity_lbs: 1000,
          perishability_hours: 48,
          requires_cold: true,
          status: 'open',
          impacted_zips: ['64108', '64105', '64127'],
          api_hash: 'seed_alert_001',
        })
        .select('id')
        .single();

      if (alertError) throw new Error(`Alert insert: ${alertError.message}`);
      alertId = newAlert.id;
    }

    // ── 3. Food batch ─────────────────────────────────────────────────────────
    const { data: existingBatch } = await supabase
      .from('food_batches')
      .select('id')
      .eq('alert_id', alertId)
      .maybeSingle();

    let batchId: string;

    if (existingBatch) {
      batchId = existingBatch.id;
    } else {
      const { data: newBatch, error: batchError } = await supabase
        .from('food_batches')
        .insert({
          alert_id: alertId,
          description: 'Fresh produce — strawberries, tomatoes, mixed greens',
          quantity_lbs: 1000,
          perishability_hours: 48,
          requires_cold: true,
          spoilage_deadline: alertDeadline,
          status: 'unallocated',
        })
        .select('id')
        .single();

      if (batchError) throw new Error(`Batch insert: ${batchError.message}`);
      batchId = newBatch.id;
    }

    // ── 4. Popup events ───────────────────────────────────────────────────────
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(14, 0, 0, 0);

    const weekend = new Date();
    weekend.setDate(weekend.getDate() + (6 - weekend.getDay() + 7) % 7 || 7);
    weekend.setHours(9, 0, 0, 0);

    const weekendEnd = new Date(weekend);
    weekendEnd.setHours(13, 0, 0, 0);

    await supabase.from('popup_events').upsert([
      {
        zip: '64105',
        lead_org: 'Crosslines Community Outreach',
        description: 'Emergency Produce Distribution — Columbus Park. Free fresh produce for all families. No ID required. Spanish spoken.',
        description_es: 'Distribución de emergencia de productos frescos. Productos frescos gratis para todas las familias. No se requiere identificación. Se habla español.',
        scheduled_at: tomorrow.toISOString(),
        ends_at: tomorrowEnd.toISOString(),
        status: 'planned',
        food_available: 'Fresh produce — strawberries, tomatoes, mixed greens',
        capacity_households: 200,
      },
      {
        zip: '64127',
        lead_org: 'Harvesters Community Food Network',
        description: 'Weekend Food Pantry Popup — Eastside. Weekly popup serving the Eastside community. Bring your own bags.',
        scheduled_at: weekend.toISOString(),
        ends_at: weekendEnd.toISOString(),
        status: 'planned',
        food_available: 'Canned goods, dry goods, fresh produce',
        capacity_households: 150,
      },
    ], { onConflict: 'zip,lead_org' });

    // ── 5. Help requests ──────────────────────────────────────────────────────
    await supabase.from('help_requests').upsert([
      { zip: '64105', barrier_type: ['no_car', 'language_barrier'], preferred_language: 'es', contact_info: null, notes: 'Necesito ayuda con transporte', status: 'open' },
      { zip: '64127', barrier_type: ['no_car'], preferred_language: 'en', contact_info: '816-555-0101', notes: 'Single parent, two kids', status: 'assigned' },
      { zip: '64130', barrier_type: ['senior', 'disability'], preferred_language: 'en', contact_info: null, notes: 'Mobility limited', status: 'open' },
      { zip: '64101', barrier_type: ['infant'], preferred_language: 'es', contact_info: '816-555-0102', notes: 'Bebé de 6 meses', status: 'open' },
      { zip: '64132', barrier_type: ['no_car', 'senior'], preferred_language: 'en', contact_info: null, notes: null, status: 'fulfilled' },
    ]);

    // ── 6. Community vote ─────────────────────────────────────────────────────
    const voteDeadline = new Date();
    voteDeadline.setDate(voteDeadline.getDate() + 14);

    await supabase.from('community_votes').upsert([
      {
        zip: '64105',
        title: 'Support a weekly popup market in your neighborhood',
        title_es: 'Apoya un mercado semanal en tu vecindario',
        description:
          'Columbus Park (64105) has one of the highest food insecurity rates in Kansas City, with 39.8% poverty and 71.4% Hispanic residents. A weekly popup market would serve 200+ families.',
        description_es:
          'Columbus Park (64105) tiene una de las tasas más altas de inseguridad alimentaria en Kansas City, con 39.8% de pobreza y 71.4% de residentes hispanos. Un mercado semanal serviría a más de 200 familias.',
        support_count: 67,
        target_count: 100,
        deadline: voteDeadline.toISOString(),
        active: true,
      },
    ], { onConflict: 'zip,title' });

    // ── 7. Analytics events ───────────────────────────────────────────────────
    const now = new Date();
    const analyticsEvents = [
      { event_type: 'distribution_completed', zip: '64105', quantity_lbs: 250, households_served: 48, notes: 'Columbus Park distribution' },
      { event_type: 'distribution_completed', zip: '64127', quantity_lbs: 180, households_served: 34, notes: 'Eastside distribution' },
      { event_type: 'distribution_completed', zip: '64130', quantity_lbs: 320, households_served: 61, notes: 'Price Chopper closure area' },
      { event_type: 'produce_rescued', zip: '64101', quantity_lbs: 200, produce_saved_lbs: 200, notes: 'Emergency produce — batch partial' },
      { event_type: 'help_fulfilled', zip: '64132', households_served: 1, notes: 'Connected to bus-accessible site' },
      { event_type: 'popup_completed', zip: '64128', quantity_lbs: 445, households_served: 89, notes: 'Dollar General closure area popup' },
    ];

    for (const event of analyticsEvents) {
      await supabase.from('analytics_events').insert({
        ...event,
        occurred_at: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return { success: true, message: `Seed complete. Alert ID: ${alertId}, Batch ID: ${batchId}` };
  } catch (e) {
    return { success: false, message: String(e) };
  }
}
