import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    const supabase = await createClient();

    const [
      { data: sites },
      { data: scores },
      { data: allocations },
    ] = await Promise.all([
      supabase
        .from('sites')
        .select('id, name, type, zip, lat, lng, capacity_lbs, cold_storage_type, languages')
        .eq('active', true),
      supabase
        .from('neighborhood_scores')
        .select('zip, need_score, poverty_rate, food_insecurity_pct, no_car_pct, hispanic_pct, food_desert'),
      supabase
        .from('allocations')
        .select('site_id, quantity_lbs, status')
        .in('status', ['confirmed', 'delivered']),
    ]);

    // ── Aggregate current allocations per site ───────────────────────────────
    const allocBySite = new Map<string, number>();
    for (const a of allocations ?? []) {
      allocBySite.set(a.site_id, (allocBySite.get(a.site_id) ?? 0) + (a.quantity_lbs ?? 0));
    }

    const scoreMap = new Map<string, {
      need_score: number | null;
      poverty_rate: number | null;
      food_insecurity_pct: number | null;
      no_car_pct: number | null;
      hispanic_pct: number | null;
      food_desert: boolean;
    }>();
    for (const s of scores ?? []) scoreMap.set(s.zip, s);

    const locatedSites = (sites ?? []).filter(s => s.lat && s.lng);

    // ── Assign short aliases ─────────────────────────────────────────────────
    const aliasedSites = locatedSites.map((s, i) => ({
      alias: `S${String(i + 1).padStart(2, '0')}`,
      site: s,
    }));
    const siteByAlias = new Map(aliasedSites.map(({ alias, site }) => [alias, site]));

    // ── Classify each site by utilization and need ───────────────────────────
    type SiteStatus = 'surplus' | 'balanced' | 'under-served' | 'unserved';

    const classified = aliasedSites.map(({ alias, site }) => {
      const ns = scoreMap.get(site.zip ?? '');
      const allocated = allocBySite.get(site.id) ?? 0;
      const cap = site.capacity_lbs ?? 500;
      const utilPct = Math.round((allocated / cap) * 100);
      const needScore = ns?.need_score ?? 0;

      let status: SiteStatus;
      if (allocated === 0) status = 'unserved';
      else if (utilPct >= 70) status = 'surplus';
      else if (utilPct >= 30) status = 'balanced';
      else status = 'under-served';

      return { alias, site, ns, allocated, cap, utilPct, needScore, status };
    });

    // ── Find gap ZIPs: high need score but no site at all ────────────────────
    const coveredZips = new Set(locatedSites.map(s => s.zip).filter(Boolean));
    const gapZips = (scores ?? [])
      .filter(s => (s.need_score ?? 0) >= 65 && !coveredZips.has(s.zip))
      .sort((a, b) => (b.need_score ?? 0) - (a.need_score ?? 0))
      .slice(0, 5);

    // ── Build prompt context ─────────────────────────────────────────────────
    const siteLines = classified.map(({ alias, site, ns, allocated, cap, utilPct, needScore, status }) =>
      `[${alias}] ${site.name} | type=${site.type} | ZIP=${site.zip ?? '?'} | need_score=${needScore} | ` +
      `allocated=${allocated}lbs / cap=${cap}lbs (${utilPct}% full) | cold=${site.cold_storage_type} | ` +
      `status=${status.toUpperCase()}${ns?.food_desert ? ' | FOOD DESERT' : ''}`
    );

    const surplusSites  = classified.filter(c => c.status === 'surplus');
    const underServed   = classified.filter(c => (c.status === 'under-served' || c.status === 'unserved') && c.needScore >= 50);
    const highNeedSites = classified.filter(c => c.needScore >= 70).sort((a, b) => b.needScore - a.needScore);

    const systemPrompt = `You are an AI allocation planner for Abundance-KC, a food distribution network in Kansas City.

You will receive the CURRENT state of all active sites — how full each is, their neighborhood need score, and whether they're in a food desert.

Your job is to propose 4–6 specific reallocation transfers that FIX imbalances: move food AWAY from surplus sites and TOWARD under-served, high-need sites.

Transfer rules:
- Source sites should be SURPLUS (≥70% full) or high-capacity food banks
- Destination sites should be UNDER-SERVED or UNSERVED, especially in high-need ZIPs
- Propose pantry-to-pantry transfers when a pantry is surplus and another is under-served — not everything has to go through the food bank
- Do not route cold food to a site with cold_storage=none
- Quantities: 100–1500 lbs, must not exceed destination capacity headroom
- Each transfer must improve the overall balance — don't move food to an already full site

Use site codes (S01, S02…) exactly as given.

Respond with JSON only — no markdown:
{
  "summary": "2-3 sentences explaining what imbalances you found and how the plan addresses them",
  "transfers": [
    {
      "from": "S01",
      "to": "S03",
      "quantity_lbs": 400,
      "reason": "Specific reason citing utilization % and need score",
      "priority": "critical|high|medium"
    }
  ]
}`;

    const userPrompt = `CURRENT NETWORK STATE (${classified.length} sites):
${siteLines.join('\n')}

SURPLUS SITES (≥70% full — can give):
${surplusSites.length > 0 ? surplusSites.map(c => `  ${c.alias} ${c.site.name} — ${c.utilPct}% full, need=${c.needScore}`).join('\n') : '  None'}

UNDER-SERVED HIGH-NEED SITES (need ≥50, <30% full or unserved):
${underServed.length > 0 ? underServed.map(c => `  ${c.alias} ${c.site.name} — ${c.utilPct}% full, need=${c.needScore}${c.ns?.food_desert ? ', FOOD DESERT' : ''}`).join('\n') : '  None'}

HIGHEST-NEED SITES (need_score ≥70):
${highNeedSites.length > 0 ? highNeedSites.slice(0, 5).map(c => `  ${c.alias} ${c.site.name} — need=${c.needScore}, ${c.utilPct}% full`).join('\n') : '  None'}

COVERAGE GAPS (high-need ZIPs with no site at all):
${gapZips.length > 0 ? gapZips.map(z => `  ZIP ${z.zip} — need=${z.need_score}, poverty=${z.poverty_rate}%${z.food_desert ? ', FOOD DESERT' : ''}`).join('\n') : '  None'}

Propose a transfer plan that rebalances the network.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      summary?: string;
      transfers?: Array<{
        from: string;
        to: string;
        quantity_lbs: number;
        reason: string;
        priority: string;
      }>;
    };

    const resolvedTransfers = (parsed.transfers ?? [])
      .filter(t => siteByAlias.has(t.from) && siteByAlias.has(t.to) && t.from !== t.to)
      .map(t => {
        const from = siteByAlias.get(t.from)!;
        const to   = siteByAlias.get(t.to)!;
        return {
          from_site: { id: from.id, name: from.name, lat: from.lat, lng: from.lng, zip: from.zip, type: from.type, capacity_lbs: from.capacity_lbs },
          to_site:   { id: to.id,   name: to.name,   lat: to.lat,   lng: to.lng,   zip: to.zip,   type: to.type,   capacity_lbs: to.capacity_lbs },
          quantity_lbs: t.quantity_lbs,
          reason:       t.reason,
          priority:     t.priority ?? 'medium',
        };
      });

    return NextResponse.json({
      success: true,
      summary: parsed.summary ?? 'Allocation plan generated.',
      transfers: resolvedTransfers,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Allocation plan error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
