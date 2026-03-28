import { NextRequest, NextResponse } from 'next/server';

// Sarah — eleven_multilingual_v2 — warm, natural bilingual voice
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const MODEL_ID = 'eleven_multilingual_v2';

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 500 });
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.80,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('ElevenLabs error status:', res.status, 'body:', err);
    return NextResponse.json({ error: 'TTS generation failed', detail: err, status: res.status }, { status: 500 });
  }

  const audio = await res.arrayBuffer();

  return new NextResponse(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400', // cache for 24h — same text = same audio
    },
  });
}
