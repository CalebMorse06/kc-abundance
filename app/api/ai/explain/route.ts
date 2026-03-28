import { NextRequest, NextResponse } from 'next/server';
import { explainAllocation } from '@/lib/ai';
import type { Site, NeighborhoodScore, AllocationRationale } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      site: Site;
      score: NeighborhoodScore | null;
      rationale: AllocationRationale;
      batchDescription: string;
    };

    const explanation = await explainAllocation(
      body.site,
      body.score,
      body.rationale,
      body.batchDescription
    );

    return NextResponse.json({ explanation });
  } catch (e) {
    return NextResponse.json(
      { explanation: null, error: String(e) },
      { status: 500 }
    );
  }
}
