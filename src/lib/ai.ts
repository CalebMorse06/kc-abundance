/**
 * AI utilities for Abundance-KC using the Anthropic Claude API (direct fetch).
 * No SDK required — uses the Messages API via native fetch.
 *
 * Gracefully falls back to deterministic, data-rich explanations when
 * ANTHROPIC_API_KEY is not set, so the app always works.
 */

import type { AllocationRationale, Site, NeighborhoodScore } from '@/types';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

async function callClaude(prompt: string, maxTokens = 150): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return (data.content?.[0]?.text as string | undefined)?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── Deterministic fallbacks ─────────────────────────────────────────────────

function buildAllocationFallback(
  site: Site,
  score: NeighborhoodScore | null,
  rationale: AllocationRationale,
): string {
  const parts: string[] = [];

  if (score?.need_score !== undefined) {
    const tier = score.need_score >= 75 ? 'critical' : score.need_score >= 50 ? 'high' : 'moderate';
    parts.push(`${site.name} (ZIP ${site.zip}) carries a ${tier} need score of ${score.need_score}/100`);
    if (score.poverty_rate && score.food_insecurity_pct) {
      parts.push(`— ${score.poverty_rate}% poverty rate and ${score.food_insecurity_pct}% food insecurity.`);
    } else {
      parts.push('.');
    }
  }

  if (rationale.cold >= 100) {
    parts.push(`It has confirmed cold storage (${site.cold_storage_type}), making it a valid recipient for perishable items.`);
  }

  if (score?.hispanic_pct && score.hispanic_pct >= 40) {
    parts.push(
      `Language match is strong: ${score.hispanic_pct}% of residents are Hispanic and this site serves in ${site.languages.join(' & ')}.`
    );
  }

  if (score?.no_car_pct && score.no_car_pct >= 35) {
    parts.push(
      rationale.transit >= 100
        ? `Transit access confirmed — important since ${score.no_car_pct}% of households are car-free.`
        : `${score.no_car_pct}% of households lack a vehicle; verify transit-accessible pickup is possible.`
    );
  }

  if (score?.food_desert) {
    parts.push(`USDA food desert designation means residents have no grocery access within 1 mile.`);
  }

  return parts.join(' ') || rationale.explanation;
}

function buildOutreachFallback(params: {
  neighborhoodName: string;
  zip: string;
  dateStr: string;
  timeStr: string;
  endTimeStr: string | null;
  foodAvailable: string | null;
  leadOrg: string | null;
}): { en: string; es: string } {
  const timeRange = params.endTimeStr
    ? `${params.timeStr} – ${params.endTimeStr}`
    : params.timeStr;
  const food = params.foodAvailable ?? 'Free food for families';
  const org = params.leadOrg ?? 'Abundance-KC';

  return {
    en: `Free food distribution in ${params.neighborhoodName} (${params.zip}) — ${params.dateStr} from ${timeRange}. ${food}. No ID required — all families welcome. Organized by ${org}.`,
    es: `Distribución gratuita de alimentos en ${params.neighborhoodName} (${params.zip}) — ${params.dateStr} de ${timeRange}. ${food}. No se requiere identificación — todas las familias son bienvenidas. Organizado por ${org}.`,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a plain-language explanation for why a site was recommended
 * for a food batch allocation.
 */
export async function explainAllocation(
  site: Site,
  score: NeighborhoodScore | null,
  rationale: AllocationRationale,
  batchDescription: string,
): Promise<string> {
  const fallback = buildAllocationFallback(site, score, rationale);

  const prompt = `You are an analyst at Abundance-KC, a food distribution coordination platform in Kansas City.

An operator needs a 1-2 sentence explanation of why this site was recommended for a food donation.

SITE: ${site.name}, ZIP ${site.zip} (${site.type})
LANGUAGES: ${site.languages.join(', ')}
COLD STORAGE: ${site.cold_storage_type}
BATCH: ${batchDescription}

SCORE BREAKDOWN (0-100):
- Neighborhood need: ${rationale.need.toFixed(1)} (30% weight)
- Cold storage match: ${rationale.cold.toFixed(1)} (25% weight)
- Language match: ${rationale.language.toFixed(1)} (20% weight)
- Capacity headroom: ${rationale.capacity.toFixed(1)} (15% weight)
- Transit access: ${rationale.transit.toFixed(1)} (10% weight)
- TOTAL: ${rationale.total.toFixed(1)}

${score ? `DEMOGRAPHICS: ${score.poverty_rate ?? '?'}% poverty, ${score.hispanic_pct ?? '?'}% Hispanic, ${score.no_car_pct ?? '?'}% no vehicle${score.food_desert ? ', USDA food desert' : ''}` : ''}

Write 1-2 sentences explaining why this site is a strong match. Be specific. Do not start with "This site".`;

  const aiResponse = await callClaude(prompt, 150);
  return aiResponse ?? fallback;
}

/**
 * Draft bilingual (EN + ES) outreach content for a popup event.
 */
export async function draftOutreach(params: {
  zip: string;
  neighborhoodName: string;
  scheduledAt: string;
  endsAt: string | null;
  foodAvailable: string | null;
  leadOrg: string | null;
  hispanicPct: number | null;
}): Promise<{ en: string; es: string }> {
  const dateStr = new Date(params.scheduledAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  });
  const timeStr = new Date(params.scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
  });
  const endTimeStr = params.endsAt
    ? new Date(params.endsAt).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago',
      })
    : null;

  const fallback = buildOutreachFallback({
    neighborhoodName: params.neighborhoodName,
    zip: params.zip,
    dateStr,
    timeStr,
    endTimeStr,
    foodAvailable: params.foodAvailable,
    leadOrg: params.leadOrg,
  });

  const timeRange = endTimeStr ? `${timeStr} – ${endTimeStr}` : timeStr;

  const prompt = `Write a short, warm SMS/flyer announcement for a free community food distribution event.

Details:
- Neighborhood: ${params.neighborhoodName} (ZIP ${params.zip})
- Date: ${dateStr}, ${timeRange}
- Food: ${params.foodAvailable ?? 'Free food for families'}
- Organizer: ${params.leadOrg ?? 'Abundance-KC'}
- Community note: ${(params.hispanicPct ?? 0) >= 40 ? 'Predominantly Spanish-speaking neighborhood.' : 'Mixed language community.'}

Respond with JSON only — no markdown, no explanation:
{"en": "2-3 sentence English announcement", "es": "Natural Spanish translation"}`;

  const raw = await callClaude(prompt, 250);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as { en?: string; es?: string };
    return {
      en: parsed.en ?? fallback.en,
      es: parsed.es ?? fallback.es,
    };
  } catch {
    return fallback;
  }
}

/**
 * Extract structured logistics fields from a supply alert's free-text description.
 * Returns quantity_lbs, perishability_hours, and requires_cold so real API alerts
 * are as rich as hand-entered ones.
 */
export async function extractAlertFields(
  title: string,
  description: string | null,
): Promise<{ quantity_lbs: number | null; perishability_hours: number | null; requires_cold: boolean }> {
  const fallback = { quantity_lbs: null, perishability_hours: null, requires_cold: false };

  const prompt = `Extract structured logistics data from this food supply alert. Return JSON only — no markdown, no explanation.

Title: ${title}
Description: ${description ?? 'None'}

Return exactly this JSON:
{"quantity_lbs": <number or null>, "perishability_hours": <number or null>, "requires_cold": <true or false>}

Rules:
- quantity_lbs: extract weight in pounds. Convert tons→lbs (1 ton=2000). Null if not mentioned.
- perishability_hours: convert to hours (2 days=48, 1 week=168, "same day"=8, "end of day"=12). Null if shelf-stable or not mentioned.
- requires_cold: true if produce, dairy, meat, frozen, or refrigeration mentioned. False otherwise.`;

  const raw = await callClaude(prompt, 80);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw.replace(/```json\n?|```/g, '').trim()) as {
      quantity_lbs?: number | null;
      perishability_hours?: number | null;
      requires_cold?: boolean;
    };
    return {
      quantity_lbs: typeof parsed.quantity_lbs === 'number' ? Math.round(parsed.quantity_lbs) : null,
      perishability_hours: typeof parsed.perishability_hours === 'number' ? Math.round(parsed.perishability_hours) : null,
      requires_cold: Boolean(parsed.requires_cold),
    };
  } catch {
    return fallback;
  }
}

/**
 * Summarize a supply alert in one urgent sentence for the command center.
 */
export async function summarizeAlert(title: string, description: string | null): Promise<string> {
  const prompt = `Summarize this food supply alert in ONE urgent sentence for a food bank operations dashboard. Start with the most critical fact.

Title: ${title}
Details: ${description ?? 'No additional details.'}`;

  const aiResponse = await callClaude(prompt, 80);
  return aiResponse ?? title;
}
