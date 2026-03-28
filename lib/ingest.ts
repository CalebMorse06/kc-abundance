/**
 * Master ingestion pipeline for FoodBridge KC.
 * Fetches all Challenge API endpoints, normalizes, and upserts to Supabase.
 */

import { createClient } from '@/lib/supabase/server';
import {
  fetchAllPantries,
  fetchFoodAtlas,
  fetchStoreClosures,
  fetchHarvest,
  fetchAllDemographics,
  fetchAllDistressCalls,
  fetchSupplyAlerts,
  fetchTransit,
  hashString,
} from '@/lib/api/challenge';
import { extractAlertFields } from '@/lib/ai';
import type {
  ChallengePantry,
  ColdStorageType,
  Language,
  SiteType,
} from '@/types';

// ── Normalization helpers ─────────────────────────────────────────────────────

function normalizeColdStorage(
  coldStorage: boolean,
  coldStorageCapacity?: string
): ColdStorageType {
  if (!coldStorage) return 'none';
  if (!coldStorageCapacity) return 'refrigerated';
  const s = coldStorageCapacity.toLowerCase();
  if (s.includes('industrial')) return 'industrial';
  if (s.includes('walk_in') || s.includes('walk-in')) return 'industrial';
  return 'refrigerated'; // small_fridge, etc.
}

function normalizeLanguages(language: string | string[] | null | undefined): Language[] {
  if (!language) return ['en'];
  const arr = Array.isArray(language) ? language : language.split(',');
  const langs: Language[] = [];
  for (const l of arr) {
    const s = l.trim().toLowerCase();
    if (s === 'english' || s === 'en') {
      if (!langs.includes('en')) langs.push('en');
    }
    if (s === 'spanish' || s === 'español' || s === 'es') {
      if (!langs.includes('es')) langs.push('es');
    }
  }
  return langs.length > 0 ? langs : ['en'];
}

const DAY_ABBREV: Record<string, string> = {
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
  fri: 'friday', sat: 'saturday', sun: 'sunday',
};

function parseTimeStr(t: string): string {
  const clean = t.trim().replace(/\s/g, '');
  const m = clean.match(/^(\d{1,2})(?::(\d{2}))?([ap]m?)?$/i);
  if (!m) return '00:00';
  let hour = parseInt(m[1], 10);
  const min = m[2] ?? '00';
  const ampm = (m[3] ?? '').toLowerCase();
  if (ampm.startsWith('p') && hour !== 12) hour += 12;
  if (ampm.startsWith('a') && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${min}`;
}

function expandDayRange(range: string): string[] {
  const all = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const abbr = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const parts = range.split('-').map((s) => s.trim().toLowerCase());
  if (parts.length === 1) {
    const full = DAY_ABBREV[parts[0]] ?? parts[0];
    return all.includes(full) ? [full] : [];
  }
  const startKey = DAY_ABBREV[parts[0]] ?? parts[0];
  const endKey = DAY_ABBREV[parts[1]] ?? parts[1];
  const si = all.indexOf(startKey);
  const ei = all.indexOf(endKey);
  if (si === -1 || ei === -1) {
    // Try abbr match
    const si2 = abbr.findIndex((a) => parts[0].startsWith(a));
    const ei2 = abbr.findIndex((a) => parts[1].startsWith(a));
    if (si2 !== -1 && ei2 !== -1) return all.slice(si2, ei2 + 1);
    return [];
  }
  return all.slice(si, ei + 1);
}

export function parseHours(raw: string | null | undefined) {
  if (!raw || raw.toLowerCase() === 'seasonal' || raw.toLowerCase() === 'schedule varies') return [];
  const results: Array<{ day: string; open: string; close: string }> = [];

  const blocks = raw.split(/[;\n]+/).map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const match = block.match(
      /^([A-Za-z\/\-,\s]+?)\s+(\d{1,2}(?::\d{2})?\s*[ap]m?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*[ap]m?)$/i
    );
    if (!match) continue;

    const dayPart = match[1].trim();
    const timePart = match[2].trim();

    const timeParts = timePart.split(/\s*[-–]\s*/);
    if (timeParts.length !== 2) continue;
    const open = parseTimeStr(timeParts[0]);
    const close = parseTimeStr(timeParts[1]);

    const daySegments = dayPart.split(/[,\/]/).map((s) => s.trim());
    for (const seg of daySegments) {
      const days = expandDayRange(seg);
      for (const day of days) {
        results.push({ day, open, close });
      }
    }
  }

  return results;
}

function normalizeSiteType(type: string | null | undefined): SiteType {
  if (!type) return 'pantry';
  const s = type.toLowerCase();
  if (s.includes('food_bank') || s.includes('food bank')) return 'food_bank';
  if (s.includes('mobile') || s.includes('distribution')) return 'mobile';
  if (s.includes('shelter')) return 'shelter';
  if (s.includes('school')) return 'school';
  if (s.includes('garden')) return 'garden';
  if (s.includes('popup') || s.includes('pop-up')) return 'popup';
  return 'pantry';
}

// ── Main ingest ───────────────────────────────────────────────────────────────

export interface IngestResult {
  sites_upserted: number;
  scores_upserted: number;
  closures_inserted: number;
  desert_tracts_inserted: number;
  harvest_zips_inserted: number;
  supply_alerts_new: number;
  transit_cache_updated: number;
  errors: string[];
}

export async function runIngest(): Promise<IngestResult> {
  const supabase = await createClient();
  const errors: string[] = [];
  const result: IngestResult = {
    sites_upserted: 0,
    scores_upserted: 0,
    closures_inserted: 0,
    desert_tracts_inserted: 0,
    harvest_zips_inserted: 0,
    supply_alerts_new: 0,
    transit_cache_updated: 0,
    errors: [],
  };

  // Fetch all data concurrently
  const [pantries, storeClosures, desertTracts, harvestZips, demographics, distressCalls, supplyAlerts] =
    await Promise.allSettled([
      fetchAllPantries(),
      fetchStoreClosures(),
      fetchFoodAtlas(),
      fetchHarvest(),
      fetchAllDemographics(),
      fetchAllDistressCalls(),
      fetchSupplyAlerts(),
    ]);

  // ── 1. Upsert sites ───────────────────────────────────────────────────────
  if (pantries.status === 'fulfilled') {
    const siteRecords = pantries.value.map((p: ChallengePantry) => ({
      source: 'challenge_api',
      external_id: p.id,
      name: p.name,
      address: p.address,
      zip: p.zip === 'various' ? null : p.zip,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      type: normalizeSiteType(p.type),
      active: true,
      hours_raw: p.hours,
      hours_parsed: parseHours(p.hours),
      languages: normalizeLanguages(p.language),
      cold_storage_type: normalizeColdStorage(p.coldStorage, p.coldStorageCapacity),
      id_required: p.idRequired ?? false,
      capacity_lbs: p.monthlyCapacity ?? null,
      phone: p.phone ?? null,
      notes: p.coldStorageNotes ?? p.routeSchedule ?? null,
    }));

    const { error } = await supabase
      .from('sites')
      .upsert(siteRecords, { onConflict: 'external_id' });

    if (error) errors.push(`Sites upsert: ${error.message}`);
    else result.sites_upserted = siteRecords.length;
  } else {
    errors.push(`Pantries fetch: ${pantries.reason}`);
  }

  // ── 2. Store closures ────────────────────────────────────────────────────
  if (storeClosures.status === 'fulfilled') {
    for (const c of storeClosures.value) {
      const { error } = await supabase.from('store_closures').upsert(
        {
          store_name: c.name,
          zip: c.zip,
          closed_date: c.closedDate,
          people_impacted: c.impactedPopulation,
          source: 'challenge_api',
        },
        { onConflict: 'store_name,zip' }
      );
      if (!error) result.closures_inserted++;
      else errors.push(`Closure upsert ${c.name}: ${error.message}`);
    }
  } else {
    errors.push(`Store closures: ${storeClosures.reason}`);
  }

  // ── 3. Food desert tracts ────────────────────────────────────────────────
  if (desertTracts.status === 'fulfilled') {
    for (const t of desertTracts.value) {
      const { error } = await supabase.from('food_desert_tracts').upsert(
        {
          tract_id: t.censusTract,
          zip: t.zip ?? null,
          food_desert: t.foodDesert,
          low_access_1mi: t.lowAccess1mi,
          low_access_10mi: t.lowAccess10mi,
          poverty_rate: t.povertyRate,
          vehicle_access_pct: t.vehicleAccess,
          population: t.population,
          snap_households: t.snapHouseholds,
          source: 'challenge_api',
        },
        { onConflict: 'tract_id' }
      );
      if (!error) result.desert_tracts_inserted++;
      else errors.push(`Desert tract ${t.censusTract}: ${error.message}`);
    }
  } else {
    errors.push(`Food atlas: ${desertTracts.reason}`);
  }

  // ── 4. Harvest priority ZIPs ─────────────────────────────────────────────
  if (harvestZips.status === 'fulfilled') {
    for (const h of harvestZips.value) {
      const { error } = await supabase.from('harvest_priority_zips').upsert(
        {
          zip: h.zip,
          priority: h.priority,
          reason: h.reason,
          weekly_lbs: h.weeklyLbs,
          agencies: h.agencies,
          last_delivery: h.lastDelivery,
          source: 'challenge_api',
        },
        { onConflict: 'zip' }
      );
      if (!error) result.harvest_zips_inserted++;
      else errors.push(`Harvest zip ${h.zip}: ${error.message}`);
    }
  } else {
    errors.push(`Harvest: ${harvestZips.reason}`);
  }

  // ── 5. Neighborhood scores ───────────────────────────────────────────────
  if (demographics.status === 'fulfilled') {
    const closuresArr = storeClosures.status === 'fulfilled' ? storeClosures.value : [];
    const callsArr = distressCalls.status === 'fulfilled' ? distressCalls.value : [];
    const harvestZipSet = new Set(
      harvestZips.status === 'fulfilled' ? harvestZips.value.map((h) => h.zip) : []
    );
    const desertZipSet = new Set(
      desertTracts.status === 'fulfilled'
        ? desertTracts.value.filter((t) => t.foodDesert).map((t) => t.zip ?? '')
        : []
    );

    for (const d of demographics.value) {
      const zip = d.zip;

      // Store closure impact for this ZIP
      const zipClosures = closuresArr.filter((c) => c.zip === zip);
      const totalImpacted = zipClosures.reduce((sum, c) => sum + (c.impactedPopulation ?? 0), 0);
      const storeClosureImpact = Math.min(totalImpacted / 50000, 1.0);

      // Distress calls for this ZIP
      const zipCalls = callsArr.find((c) => c.zip === zip);
      const maxCalls = 500;
      const distressCallsNorm = zipCalls ? Math.min(zipCalls.count / maxCalls, 1.0) : 0;

      const isDesert = desertZipSet.has(zip);
      const isHarvest = harvestZipSet.has(zip);

      // Compute need score
      const poverty = Math.min(d.povertyRate / 100, 1.0);
      const foodInsec = Math.min(d.foodInsecurityRate / 100, 1.0);
      const noCar = Math.min(d.noVehiclePct / 100, 1.0);

      let needScore =
        poverty * 0.25 +
        foodInsec * 0.25 +
        noCar * 0.20 +
        storeClosureImpact * 0.15 +
        distressCallsNorm * 0.10 +
        (isDesert ? 1 : 0) * 0.05;

      needScore = needScore * 100;
      if (isHarvest) needScore = needScore * 1.15;
      needScore = Math.min(needScore, 100);

      const { error } = await supabase.from('neighborhood_scores').upsert(
        {
          zip,
          poverty_rate: d.povertyRate,
          food_insecurity_pct: d.foodInsecurityRate,
          no_car_pct: d.noVehiclePct,
          hispanic_pct: d.hispanicPct,
          distress_calls: zipCalls?.count ?? 0,
          store_closure_impact: storeClosureImpact,
          food_desert: isDesert,
          harvest_priority: isHarvest,
          need_score: Math.round(needScore * 10) / 10,
          score_computed_at: new Date().toISOString(),
        },
        { onConflict: 'zip' }
      );

      if (error) errors.push(`Score ${zip}: ${error.message}`);
      else result.scores_upserted++;
    }
  } else {
    errors.push(`Demographics: ${demographics.reason}`);
  }

  // ── 6. Supply alerts (API context alerts) ────────────────────────────────
  if (supplyAlerts.status === 'fulfilled') {
    const alertsData = supplyAlerts.value;
    for (const alert of alertsData.alerts) {
      const alertHash = hashString(JSON.stringify(alert));

      const { data: existing } = await supabase
        .from('supply_alerts')
        .select('id')
        .eq('api_hash', alertHash)
        .maybeSingle();

      if (!existing) {
        const fields = await extractAlertFields(alert.title, alert.description ?? null);

        const { error } = await supabase.from('supply_alerts').insert({
          source: 'challenge_api',
          title: alert.title,
          description: alert.description,
          alert_type: alert.type,
          severity: alert.severity,
          impacted_zips: alert.impactedZips,
          quantity_lbs: fields.quantity_lbs,
          perishability_hours: fields.perishability_hours,
          requires_cold: fields.requires_cold,
          status: 'open',
          api_hash: alertHash,
        });

        if (error) errors.push(`Supply alert ${alert.id}: ${error.message}`);
        else result.supply_alerts_new++;
      }
    }
  } else {
    errors.push(`Supply alerts: ${supplyAlerts.reason}`);
  }

  // ── 7. Transit cache ─────────────────────────────────────────────────────────
  // Fetch KCATA transit stops for every site that has coordinates and write
  // to site_transit_cache so the allocation scoring engine can use transit
  // accessibility as a real signal (not always 0).
  try {
    const { data: siteRows } = await supabase
      .from('sites')
      .select('id, lat, lng')
      .eq('active', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    if (siteRows && siteRows.length > 0) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

      // Fetch transit for each site sequentially to avoid hammering the API
      for (const site of siteRows as { id: string; lat: number; lng: number }[]) {
        try {
          const stops = await fetchTransit(site.lat, site.lng);
          const { error } = await supabase.from('site_transit_cache').upsert(
            {
              site_id: site.id,
              stops,                  // ChallengeTransitStop[] — scoring engine only checks .length
              transit_data: stops,
              fetched_at: now.toISOString(),
              expires_at: expiresAt,
            },
            { onConflict: 'site_id' }
          );
          if (!error) result.transit_cache_updated++;
          else errors.push(`Transit cache ${site.id}: ${error.message}`);
        } catch (e) {
          errors.push(`Transit fetch ${site.id}: ${String(e)}`);
        }
      }
    }
  } catch (e) {
    errors.push(`Transit cache step: ${String(e)}`);
  }

  result.errors = errors;
  return result;
}
