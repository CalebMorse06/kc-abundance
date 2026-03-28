'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Users, ThumbsUp, Clock, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NeedScoreBadge } from '@/components/NeedScoreBadge';
import { SpeakButton } from '@/components/SpeakButton';
import { useLanguage } from '@/lib/i18n';
import type { CommunityVote, NeighborhoodScore, StoreClosure } from '@/types';

type StoreClosureRow = StoreClosure & { address?: string | null; closure_date?: string | null };

const ZIP_NAMES: Record<string, string> = {
  '64101': 'Downtown Kansas City',
  '64105': 'Columbus Park',
  '64127': 'Eastside',
  '64128': 'Swope Park',
  '64130': 'Troost Corridor',
  '64132': 'Waldo / Brookside Area',
};

function generateFingerprint(): string {
  const nav = typeof window !== 'undefined' ? window.navigator : null;
  const scr = typeof screen !== 'undefined' ? screen : null;
  const str = [nav?.userAgent, nav?.language, scr?.width, scr?.height, new Date().getTimezoneOffset()].join('|');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36) + Date.now().toString(36).slice(-4);
}

function SpoilageCountdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('0 days'); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(`${days}d ${hours}h`);
    };
    update();
    const i = setInterval(update, 60000);
    return () => clearInterval(i);
  }, [deadline]);
  return <span>{timeLeft}</span>;
}

export default function CommunityPage() {
  const params = useParams();
  const zip = params.zip as string;
  const { lang, setLang } = useLanguage();
  const [vote, setVote] = useState<CommunityVote | null>(null);
  const [ns, setNs] = useState<NeighborhoodScore | null>(null);
  const [closures, setClosures] = useState<StoreClosureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const [fingerprint] = useState(() => generateFingerprint());

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: voteData }, { data: nsData }, { data: closureData }] = await Promise.all([
        supabase.from('community_votes').select('*').eq('zip', zip).eq('active', true).maybeSingle(),
        supabase.from('neighborhood_scores').select('*').eq('zip', zip).maybeSingle(),
        supabase.from('store_closures').select('*').eq('zip', zip),
      ]);
      setVote(voteData as CommunityVote | null);
      setNs(nsData as NeighborhoodScore | null);
      setClosures((closureData ?? []) as StoreClosureRow[]);
      setLoading(false);

      // Check if already voted
      if (voteData) {
        const { data: signal } = await supabase
          .from('vote_signals')
          .select('id')
          .eq('vote_id', voteData.id)
          .eq('fingerprint', fingerprint)
          .maybeSingle();
        if (signal) setVoted(true);
      }
    }
    load();
  }, [zip, fingerprint]);

  const handleVote = async () => {
    if (!vote || voted || voteLoading) return;
    setVoteLoading(true);
    try {
      const res = await fetch(`/api/vote/${vote.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint }),
      });
      const data = await res.json();
      if (data.success) {
        setVote((prev) => prev ? { ...prev, support_count: data.new_count } : prev);
        setVoted(true);
      } else if (data.error === 'already_voted') {
        setVoted(true);
      }
    } catch {
      // silent
    } finally {
      setVoteLoading(false);
    }
  };

  const isEs = lang === 'es';
  const neighborhoodName = ZIP_NAMES[zip] ?? `ZIP ${zip}`;
  const progressPct = vote ? Math.min((vote.support_count / vote.target_count) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="h-8 w-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">{isEs ? 'Cargando...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Lang toggle */}
      <div className="flex items-center justify-between mb-6">
        <nav className="flex items-center gap-1 text-sm text-gray-500">
          <a href="/" className="hover:text-green-700 transition-colors">Home</a>
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          <span className="text-gray-900 font-medium">{neighborhoodName}</span>
        </nav>
        <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5">
          {(['en', 'es'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${lang === l ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-sm text-green-700 mb-3">
          <Users className="h-3.5 w-3.5" />
          <span>ZIP {zip}</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEs ? `${neighborhoodName} — Apoyo Comunitario` : `${neighborhoodName} — Community Support`}
        </h1>
        <p className="mt-2 text-gray-600">
          {isEs
            ? 'Ayuda a traer recursos de alimentos a tu vecindario'
            : 'Help bring food resources to your neighborhood'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vote section */}
          {vote && (
            <div className="rounded-2xl border-2 border-green-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
                <div className="flex items-center gap-2 text-white">
                  <ThumbsUp className="h-5 w-5" />
                  <span className="text-sm font-medium opacity-90">Community Campaign</span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {isEs ? vote.title_es : vote.title}
                </h2>
              </div>

              <div className="p-6">
                {vote.description && (
                  <p className="text-sm text-gray-600 mb-5">
                    {isEs ? vote.description_es : vote.description}
                  </p>
                )}

                {/* Progress */}
                <div className="mb-5">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-bold text-2xl text-gray-900">{vote.support_count.toLocaleString()}</span>
                    <span className="text-gray-500">
                      {isEs ? 'de' : 'of'} {vote.target_count.toLocaleString()} {isEs ? 'votos necesarios' : 'votes needed'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {Math.round(progressPct)}% towards goal
                  </div>
                </div>

                {/* Deadline */}
                {vote.deadline && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span>
                      {isEs ? 'Campaña termina en' : 'Campaign ends in'}:{' '}
                      <strong className="text-gray-700">
                        <SpoilageCountdown deadline={vote.deadline} />
                      </strong>
                    </span>
                  </div>
                )}

                {/* Vote button */}
                <button
                  onClick={handleVote}
                  disabled={voted || voteLoading}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all ${
                    voted
                      ? 'bg-green-100 text-green-700 cursor-default border-2 border-green-200'
                      : 'bg-green-600 text-white hover:bg-green-700 shadow-sm active:scale-[0.98]'
                  }`}
                >
                  {voteLoading ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : voted ? (
                    <>✓ {isEs ? '¡Apoyado!' : 'Supported!'}</>
                  ) : (
                    <>
                      <ThumbsUp className="h-5 w-5" />
                      {isEs ? 'Apoyo Esto' : 'I Support This'}
                    </>
                  )}
                </button>
                {voted && (
                  <p className="text-center text-xs text-green-600 mt-2">
                    {isEs ? '¡Gracias por tu apoyo!' : 'Thank you for your support!'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Demographic context */}
          {ns && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {isEs ? 'Contexto del Vecindario' : 'Neighborhood Context'}
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: isEs ? 'Tasa de Pobreza' : 'Poverty Rate', value: `${ns.poverty_rate}%`, color: 'text-red-600' },
                  { label: isEs ? 'Sin Vehículo' : 'No Vehicle', value: `${ns.no_car_pct}%`, color: 'text-orange-600' },
                  { label: isEs ? 'Hispano/Latino' : 'Hispanic/Latino', value: `${ns.hispanic_pct}%`, color: 'text-blue-600' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">{isEs ? 'Puntuación de Necesidad' : 'Community Need Score'}</p>
                <NeedScoreBadge score={ns.need_score ?? 0} size="md" />
              </div>

              {ns.food_desert && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    {isEs
                      ? 'Esta zona está clasificada como desierto alimentario por el USDA'
                      : 'This area is classified as a USDA Food Desert Zone'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Store closures context */}
          {closures.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {isEs ? 'Cierres de Tiendas Cercanas' : 'Nearby Store Closures'}
              </h2>
              <div className="space-y-3">
                {closures.map((c) => (
                  <div key={c.id} className="rounded-xl bg-red-50 border border-red-100 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{c.store_name}</p>
                        <p className="text-sm text-gray-500">{c.address}</p>
                        {c.closure_date && (
                          <p className="text-xs text-red-600 mt-1">
                            {isEs ? 'Cerrado desde:' : 'Closed since:'} {new Date(c.closure_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-red-700">{c.people_impacted?.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">{isEs ? 'personas afectadas' : 'people impacted'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* What happens if vote succeeds */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {isEs ? '¿Qué pasa si ganamos?' : 'What happens if we reach the goal?'}
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-2">
                <span className="text-green-600 font-bold">1.</span>
                <span>{isEs ? 'Abundance-KC programa un evento emergente' : 'Abundance-KC schedules a popup event'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-green-600 font-bold">2.</span>
                <span>{isEs ? 'Coordinamos con despensas locales' : 'We coordinate with local pantries'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-green-600 font-bold">3.</span>
                <span>{isEs ? 'Distribución semanal comienza' : 'Weekly distribution begins'}</span>
              </div>
            </div>
          </div>

          {/* Listen in Spanish */}
          {vote && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                {isEs ? 'Escucha en español' : 'Listen in Spanish'}
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {isEs ? 'Haz clic para escuchar la información de esta campaña.' : 'Click to hear this campaign read aloud in Spanish.'}
              </p>
              <SpeakButton
                text={`${vote.title_es ?? vote.title}. ${vote.description_es ?? vote.description ?? ''}. Para apoyar esta campaña, haz clic en el botón "Apoyo Esto". Se necesitan ${vote.target_count - vote.support_count} votos más para llegar a la meta.`}
              />
            </div>
          )}

          {/* QR / outreach */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm text-center">
            {/* Real scannable QR code via qrserver.com — free, no auth, CORS-enabled */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`https://abundance-kc.org/community/${zip}`)}&color=1B3A52&bgcolor=FFFFFF&margin=6`}
              alt={`QR code for abundance-kc.org/community/${zip}`}
              width={120}
              height={120}
              className="mx-auto rounded-lg mb-3"
              style={{ imageRendering: 'pixelated' }}
            />
            <p className="text-xs" style={{ color: '#6B7280' }}>
              {isEs ? 'Escanea para compartir con tu comunidad' : 'Scan to share with your community'}
            </p>
            <p className="mt-1 text-xs font-medium truncate" style={{ color: 'var(--brand-teal)' }}>
              abundance-kc.org/community/{zip}
            </p>
          </div>

          {/* Get help CTA */}
          <a
            href="/request-help"
            className="block rounded-2xl bg-green-600 p-5 text-white hover:bg-green-700 transition-colors"
          >
            <h3 className="font-semibold mb-1">
              {isEs ? '¿Necesitas ayuda ahora?' : 'Need food help now?'}
            </h3>
            <p className="text-sm text-green-100">
              {isEs ? 'Solicita asistencia directa →' : 'Request direct assistance →'}
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
