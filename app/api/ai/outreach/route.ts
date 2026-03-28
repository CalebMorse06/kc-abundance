import { NextRequest, NextResponse } from 'next/server';
import { draftOutreach } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await draftOutreach(body);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
