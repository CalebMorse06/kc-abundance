import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { fingerprint } = body as { fingerprint: string };

    if (!fingerprint || typeof fingerprint !== 'string') {
      return NextResponse.json(
        { success: false, error: 'fingerprint required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check for duplicate vote
    const { data: existingSignal } = await supabase
      .from('vote_signals')
      .select('id')
      .eq('vote_id', id)
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (existingSignal) {
      return NextResponse.json({
        success: false,
        error: 'already_voted',
        message: 'You have already voted for this item',
      });
    }

    // Get current vote count
    const { data: vote, error: fetchError } = await supabase
      .from('community_votes')
      .select('id, support_count')
      .eq('id', id)
      .eq('active', true)
      .single();

    if (fetchError || !vote) {
      return NextResponse.json(
        { success: false, error: 'Vote not found or inactive' },
        { status: 404 }
      );
    }

    // Insert vote signal
    await supabase.from('vote_signals').insert({
      vote_id: id,
      fingerprint,
    });

    // Increment support count
    const newCount = vote.support_count + 1;
    const { error: updateError } = await supabase
      .from('community_votes')
      .update({ support_count: newCount })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update vote count' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      new_count: newCount,
    });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
