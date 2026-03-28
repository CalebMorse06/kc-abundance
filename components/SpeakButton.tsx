'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Square } from 'lucide-react';

interface SpeakButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function SpeakButton({ text, label = 'Escuchar en español', className = '' }: SpeakButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      audioRef.current?.pause();
    };
  }, []);

  async function handleSpeak() {
    // If already playing — stop
    if (state === 'playing') {
      audioRef.current?.pause();
      audioRef.current && (audioRef.current.currentTime = 0);
      setState('idle');
      return;
    }

    setState('loading');

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();

      // Revoke previous URL if any
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => setState('idle');
      audio.onerror = () => setState('error');

      await audio.play();
      setState('playing');
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }

  const isLoading = state === 'loading';
  const isPlaying = state === 'playing';
  const isError = state === 'error';

  return (
    <button
      onClick={handleSpeak}
      disabled={isLoading}
      aria-label={isPlaying ? 'Detener audio' : label}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      style={
        isPlaying
          ? { background: '#1B3A52', color: 'white' }
          : isError
          ? { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }
          : {
              background: 'var(--brand-orange-faint)',
              color: 'var(--brand-navy)',
              border: '1px solid rgba(245,166,35,0.35)',
            }
      }
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
      {isPlaying && <Square className="h-4 w-4 flex-shrink-0" />}
      {!isLoading && !isPlaying && !isError && <Volume2 className="h-4 w-4 flex-shrink-0" />}
      {isError && <VolumeX className="h-4 w-4 flex-shrink-0" />}

      <span>
        {isLoading ? 'Generando audio…' : isPlaying ? 'Detener' : isError ? 'Error — intentar de nuevo' : label}
      </span>

      {isPlaying && (
        <span className="flex gap-0.5 items-end h-4 ml-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-0.5 rounded-full"
              style={{
                background: 'var(--brand-orange)',
                height: `${8 + i * 4}px`,
                animation: `sound-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
