import { NextResponse } from 'next/server';
import { runIngest } from '@/lib/ingest';

export async function GET() {
  try {
    const result = await runIngest();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
