import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: alloc, error: fetchErr } = await supabase
    .from('allocations')
    .select('*, sites(*)')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !alloc) {
    return NextResponse.json({ success: false, error: 'Allocation not found' }, { status: 404 });
  }

  if (alloc.status === 'delivered') {
    return NextResponse.json({ success: true, already_confirmed: true });
  }

  // Mark allocation delivered
  await supabase
    .from('allocations')
    .update({ status: 'delivered' })
    .eq('id', id);

  // Mark batch delivered if linked
  if (alloc.batch_id) {
    await supabase
      .from('food_batches')
      .update({ status: 'delivered' })
      .eq('id', alloc.batch_id);
  }

  // Log distribution_completed — this is what the analytics page sums
  await supabase.from('analytics_events').insert({
    event_type: 'distribution_completed',
    zip: (alloc.sites as { zip: string | null } | null)?.zip ?? null,
    site_id: alloc.site_id,
    quantity_lbs: alloc.quantity_lbs,
    occurred_at: new Date().toISOString(),
    notes: `Delivery confirmed via dispatch card — allocation ${id}`,
  });

  return NextResponse.json({ success: true });
}
