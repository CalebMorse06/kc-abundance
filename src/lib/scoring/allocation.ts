import type { Site, FoodBatch, NeighborhoodScore, AllocationCandidate, AllocationRationale } from '@/types';

type SiteTransitCache = { site_id: string; stops: { stop_id: string; name: string; routes: string[]; distance_m: number }[]; transit_data: unknown; fetched_at: string; expires_at: string };

export interface AllocationInput {
  batch: FoodBatch;
  sites: Site[];
  neighborhoodScores: NeighborhoodScore[];
  transitCache: SiteTransitCache[];
  primaryLanguageByZip: Record<string, string>;  // zip -> 'en' | 'es'
}

/**
 * Score sites for a food batch allocation.
 *
 * site_score = (
 *   need_score_of_zip * 0.30
 *   + cold_storage_match * 0.25   // 1.0 if match, 0 if required but missing
 *   + language_match * 0.20       // 1.0 if site languages include zip primary language
 *   + capacity_available_norm * 0.15
 *   + transit_accessible * 0.10
 * ) * 100
 *
 * Hard rule: exclude site if batch.requires_cold AND site.cold_storage_type='none'
 */
export function scoreSitesForBatch(input: AllocationInput): AllocationCandidate[] {
  const { batch, sites, neighborhoodScores, transitCache, primaryLanguageByZip } = input;

  const scoreMap = new Map<string, NeighborhoodScore>();
  for (const ns of neighborhoodScores) {
    scoreMap.set(ns.zip, ns);
  }

  const transitMap = new Map<string, SiteTransitCache>();
  for (const tc of transitCache) {
    transitMap.set(tc.site_id, tc);
  }

  const maxCapacity = Math.max(...sites.map((s) => s.capacity_lbs ?? 0), 1);

  const candidates: AllocationCandidate[] = [];

  for (const site of sites) {
    // Hard exclusion: batch requires cold but site has no cold storage
    if (batch.requires_cold && site.cold_storage_type === 'none') {
      continue;
    }

    const ns = scoreMap.get(site.zip ?? '') ?? null;
    const needScoreNorm = ns ? (ns.need_score ?? 0) / 100 : 0.3; // default if unknown

    // Cold storage match: 1.0 if batch requires cold and site has it, or batch doesn't require cold
    let coldMatch = 1.0;
    if (batch.requires_cold) {
      coldMatch = site.cold_storage_type !== 'none' ? 1.0 : 0.0;
    }
    // Bonus for industrial cold when batch is large
    if (batch.requires_cold && site.cold_storage_type === 'industrial') {
      coldMatch = Math.min(coldMatch + 0.1, 1.0);
    }

    // Language match: does site serve the primary language of its ZIP?
    const zipPrimaryLang = primaryLanguageByZip[site.zip ?? ''] ?? 'en';
    const languageMatch = site.languages.includes(zipPrimaryLang as 'en' | 'es') ? 1.0 : 0.5;

    // Capacity: how much capacity relative to batch size
    const siteCapacity = site.capacity_lbs ?? 500;
    const capacityAvailableNorm = Math.min(siteCapacity / Math.max(batch.quantity_lbs, 1), 1.0);

    // Transit accessibility: does the site have nearby transit stops?
    const tc = transitMap.get(site.id);
    const transitAccessible = tc && tc.stops.length > 0 ? 1.0 : 0.0;

    // Weighted sum
    const weightedSum =
      needScoreNorm * 0.30 +
      coldMatch * 0.25 +
      languageMatch * 0.20 +
      capacityAvailableNorm * 0.15 +
      transitAccessible * 0.10;

    const totalScore = Math.round(weightedSum * 100 * 10) / 10;

    const explanation = buildExplanation({
      site,
      needScoreNorm,
      coldMatch,
      languageMatch,
      capacityAvailableNorm,
      transitAccessible,
      ns,
      batch,
    });

    const rationale: AllocationRationale = {
      need: Math.round(needScoreNorm * 100),
      cold: Math.round(coldMatch * 100),
      language: Math.round(languageMatch * 100),
      capacity: Math.round(capacityAvailableNorm * 100),
      transit: Math.round(transitAccessible * 100),
      total: totalScore,
      explanation,
    };

    candidates.push({ site, score: totalScore, rationale, neighborhood_score: ns });
  }

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

function buildExplanation(params: {
  site: Site;
  needScoreNorm: number;
  coldMatch: number;
  languageMatch: number;
  capacityAvailableNorm: number;
  transitAccessible: number;
  ns: NeighborhoodScore | null;
  batch: FoodBatch;
}): string {
  const { site, needScoreNorm, coldMatch, languageMatch, capacityAvailableNorm, transitAccessible, ns, batch } = params;

  const parts: string[] = [];

  if (ns) {
    parts.push(`ZIP ${site.zip} has a need score of ${ns.need_score}/100 (poverty ${ns.poverty_rate}%, no-car ${ns.no_car_pct}%)`);
  }

  if (batch.requires_cold) {
    if (coldMatch >= 1.0) {
      parts.push(`${site.name} has ${site.cold_storage_type} cold storage matching batch requirements`);
    } else {
      parts.push(`Cold storage mismatch warning`);
    }
  }

  if (languageMatch >= 1.0) {
    const langs = site.languages.map((l) => l.toUpperCase()).join(', ');
    parts.push(`Site serves ${langs} which matches ZIP's primary language`);
  } else {
    parts.push(`Language coverage partial for this ZIP's primary language`);
  }

  if (capacityAvailableNorm >= 1.0) {
    parts.push(`Site has sufficient capacity for the full ${batch.quantity_lbs} lbs`);
  } else {
    parts.push(`Site capacity may require splitting the ${batch.quantity_lbs} lb batch`);
  }

  if (transitAccessible) {
    parts.push(`Bus-accessible location helps households without cars`);
  } else {
    parts.push(`Limited transit access — may need delivery support`);
  }

  return parts.join('. ') + '.';
}
