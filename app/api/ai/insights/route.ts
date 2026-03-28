import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    const supabase = await createClient();

    // Pull all relevant data in parallel
    const [
      { data: alerts },
      { data: batches },
      { data: allocations },
      { data: scores },
      { data: sites },
      { data: popups },
      { data: analytics },
    ] = await Promise.all([
      supabase.from('supply_alerts').select('id, title, quantity_lbs, perishability_hours, requires_cold, status, created_at, impacted_zips').order('created_at', { ascending: false }).limit(10),
      supabase.from('food_batches').select('id, quantity_lbs, food_type, requires_cold, status, perishability_hours, spoilage_deadline').order('created_at', { ascending: false }).limit(20),
      supabase.from('allocations').select('id, quantity_lbs, status, site_id, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('neighborhood_scores').select('zip, need_score, poverty_rate, food_insecurity_pct, hispanic_pct, no_car_pct, food_desert').order('need_score', { ascending: false }).limit(15),
      supabase.from('sites').select('id, name, type, zip, capacity_lbs, cold_storage_type, active').eq('active', true),
      supabase.from('popup_events').select('id, zip, status, triggered_by_alert_id, scheduled_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('analytics_events').select('event_type, zip, quantity_lbs, occurred_at').order('occurred_at', { ascending: false }).limit(20),
    ]);

    // Compute derived stats for the prompt
    const openAlerts = (alerts ?? []).filter(a => a.status === 'open').length;
    const lbsInFlow = (allocations ?? []).filter(a => a.status === 'confirmed' || a.status === 'delivered').reduce((s, a) => s + (a.quantity_lbs ?? 0), 0);
    const unallocatedBatches = (batches ?? []).filter(b => b.status === 'unallocated');
    const criticalZips = (scores ?? []).filter(s => (s.need_score ?? 0) >= 70);
    const coveredZips = new Set((sites ?? []).map(s => s.zip).filter(Boolean));
    const gapZips = criticalZips.filter(z => !coveredZips.has(z.zip));
    const spoilingBatches = unallocatedBatches.filter(b => {
      if (!b.spoilage_deadline) return false;
      const hoursLeft = (new Date(b.spoilage_deadline).getTime() - Date.now()) / 3600000;
      return hoursLeft < 12;
    });

    const systemPrompt = `You are the AI operations advisor for Abundance-KC, a food logistics coordination platform in Kansas City, Missouri. You analyze real-time food distribution data and provide actionable recommendations to operators.

Your job is to review the current operational state and return 3-5 specific, prioritized insights. Each insight should be concrete and actionable — not generic advice.

Scoring weights used by our allocation engine:
- Neighborhood need score: 30% (USDA food insecurity, poverty rate)
- Cold storage match: 25% (required for produce/dairy)
- Language match: 20% (Spanish-speaking household %)
- Capacity headroom: 15% (available lbs vs site capacity)
- Transit access: 10% (bus route proximity)

Respond with JSON only — no markdown:
{
  "summary": "1-2 sentence overall operational status",
  "insights": [
    {
      "priority": "critical|high|medium",
      "title": "Short title",
      "detail": "2-3 sentence specific recommendation with data references",
      "action": "Single imperative sentence — what to do right now"
    }
  ]
}`;

    const userPrompt = `Current operational snapshot:

SUPPLY ALERTS (last 10):
${(alerts ?? []).map(a => `- [${a.status.toUpperCase()}] "${a.title}" — ${a.quantity_lbs ?? '?'} lbs, ${a.perishability_hours ?? 'shelf-stable'}hr window, cold=${a.requires_cold}, ZIPs=${(a.impacted_zips ?? []).join(', ')}`).join('\n') || 'None'}

UNALLOCATED BATCHES (${unallocatedBatches.length} total, ${spoilingBatches.length} spoiling <12h):
${unallocatedBatches.slice(0, 8).map(b => {
  const hrs = b.spoilage_deadline ? Math.round((new Date(b.spoilage_deadline).getTime() - Date.now()) / 3600000) : null;
  return `- ${b.quantity_lbs} lbs ${b.food_type}, cold=${b.requires_cold}${hrs !== null ? `, ${hrs}h remaining` : ''}`;
}).join('\n') || 'None'}

RECENT ALLOCATIONS (${(allocations ?? []).length} total):
- ${lbsInFlow.toLocaleString()} lbs confirmed/delivered
- ${(allocations ?? []).filter(a => a.status === 'pending').length} pending confirmation

ACTIVE SITES (${(sites ?? []).length} total):
${(sites ?? []).slice(0, 8).map(s => `- ${s.name} (${s.type}, ZIP ${s.zip}, cap=${s.capacity_lbs ?? '?'} lbs, cold=${s.cold_storage_type})`).join('\n')}

TOP NEED NEIGHBORHOODS (${criticalZips.length} critical ≥70):
${criticalZips.slice(0, 6).map(z => `- ZIP ${z.zip}: need=${z.need_score}, poverty=${z.poverty_rate}%, food_insecure=${z.food_insecurity_pct}%, hispanic=${z.hispanic_pct}%, no_car=${z.no_car_pct}%, desert=${z.food_desert}`).join('\n')}

COVERAGE GAPS (critical ZIPs with no active site): ${gapZips.map(z => z.zip).join(', ') || 'None'}

OPEN ALERTS: ${openAlerts}
ESCALATED POPUPS: ${(popups ?? []).filter(p => p.status === 'active').length} active`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as {
      summary?: string;
      insights?: Array<{ priority: string; title: string; detail: string; action: string }>;
    };

    return NextResponse.json({
      success: true,
      summary: parsed.summary ?? 'Analysis complete.',
      insights: parsed.insights ?? [],
      meta: {
        open_alerts: openAlerts,
        lbs_in_flow: lbsInFlow,
        critical_zips: criticalZips.length,
        gap_zips: gapZips.length,
        spoiling_soon: spoilingBatches.length,
      },
    });
  } catch (err) {
    console.error('AI insights error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
