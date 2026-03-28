import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { MapPin, Clock, Phone, Bus, Snowflake, ArrowLeft, ExternalLink, Navigation } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchTransit } from '@/lib/api/challenge';
import { getLangFromCookie } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { NeedScoreBadge } from '@/components/NeedScoreBadge';
import { SpeakButton } from '@/components/SpeakButton';
import type { Site, NeighborhoodScore, PopupEvent, ChallengeTransitStop } from '@/types';

type SiteTransitStop = { stop_id: string; name: string; routes: string[]; distance_m: number };
type SiteTransitCache = { site_id: string; stops: SiteTransitStop[]; transit_data: unknown; fetched_at: string; expires_at: string };

interface PageProps {
  params: Promise<{ id: string }>;
}

function buildSpanishNarration(s: Site): string {
  const parts: string[] = [];

  parts.push(`${s.name}.`);

  if (s.address) {
    parts.push(`Dirección: ${s.address}, Kansas City, Misuri ${s.zip ?? ''}.`);
  }

  if (s.hours_raw) {
    parts.push(`Horario: ${s.hours_raw}.`);
  }

  if (s.id_required) {
    parts.push('Se requiere identificación para recibir alimentos.');
  } else {
    parts.push('No se necesita identificación en este lugar.');
  }

  if (s.languages.includes('es')) {
    parts.push('Este sitio ofrece atención en español.');
  }

  if (s.cold_storage_type !== 'none') {
    parts.push('Hoy hay productos frescos disponibles, incluyendo frutas y verduras.');
  } else {
    parts.push('Este sitio ofrece alimentos no perecederos como enlatados y granos.');
  }

  if (s.phone) {
    parts.push(`Para más información, puedes llamar al ${s.phone}.`);
  }

  parts.push('Para obtener ayuda para llegar, usa el botón de solicitar ayuda en esta página.');

  return parts.join(' ');
}

function formatHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}${m > 0 ? ':' + String(m).padStart(2, '0') : ''}${suffix}`;
}

function dayLabel(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1, 3);
}

export default async function SiteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const lang = getLangFromCookie(cookieStore.toString());
  const isEs = lang === 'es';
  const supabase = await createClient();

  const { data: site } = await supabase.from('sites').select('*').eq('id', id).maybeSingle();
  if (!site) notFound();

  const s = site as Site;

  const [{ data: nsData }, { data: transitData }, { data: popups }] = await Promise.all([
    supabase.from('neighborhood_scores').select('*').eq('zip', s.zip).maybeSingle(),
    supabase.from('site_transit_cache').select('*').eq('site_id', id).maybeSingle(),
    supabase
      .from('popup_events')
      .select('*')
      .eq('site_id', id)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(3),
  ]);

  const ns = nsData as NeighborhoodScore | null;
  const transit = transitData as SiteTransitCache | null;
  const upcomingEvents = (popups ?? []) as PopupEvent[];

  // If no cached transit and site has coordinates, fetch live from challenge API
  let liveTransit: ChallengeTransitStop[] = [];
  const hasNoTransitCache = !transit || transit.stops.length === 0;
  if (hasNoTransitCache && s.lat && s.lng) {
    try {
      liveTransit = await fetchTransit(s.lat, s.lng);
    } catch {
      liveTransit = [];
    }
  }
  const hasSpanish = s.languages.includes('es');
  const hasCold = s.cold_storage_type !== 'none';

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/map"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEs ? 'Regresar al mapa' : 'Back to map'}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Site header */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="default">{s.type.replace(/_/g, ' ')}</Badge>
              {hasSpanish && <Badge variant="info">Español disponible</Badge>}
              {!s.id_required && <Badge variant="secondary">{isEs ? 'Sin ID Requerida' : 'No ID Required'}</Badge>}
              {hasCold && (
                <Badge variant="info" className="flex items-center gap-1">
                  <Snowflake className="h-3 w-3" />
                  {isEs ? 'Productos Frescos' : 'Fresh Produce Available'}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900">{s.name}</h1>
            {hasSpanish && s.name && (
              <p className="text-sm text-gray-500 mt-0.5 italic">
                {isEs ? 'Este sitio ofrece atención en inglés y español' : 'This site provides assistance in English and Spanish'}
              </p>
            )}


            <div className="mt-4 flex items-start gap-2 text-gray-600">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#2D8C7A]" />
              <div>
                <p>{s.address}</p>
                <p className="text-sm text-gray-400">Kansas City, MO {s.zip}</p>
              </div>
            </div>

            {s.phone && (
              <div className="mt-3 flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4 text-[#2D8C7A]" />
                <a href={`tel:${s.phone}`} className="hover:text-[#1B3A52] transition-colors">
                  {s.phone}
                </a>
              </div>
            )}
          </div>

          {/* Hours */}
          {s.hours_parsed && s.hours_parsed.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-[#2D8C7A]" />
                <h2 className="text-lg font-semibold text-gray-900">{isEs ? 'Horario' : 'Hours'}</h2>
              </div>
              <div className="space-y-2">
                {s.hours_parsed.map((h, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm font-medium text-gray-700 w-24">
                      {dayLabel(h.day)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatHour(h.open)} – {formatHour(h.close)}
                    </span>
                  </div>
                ))}
              </div>
              {s.hours_raw && (
                <p className="mt-3 text-xs text-gray-400 italic">
                  Raw hours: {s.hours_raw}
                </p>
              )}
            </div>
          )}

          {/* Access details */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{isEs ? 'Requisitos de Acceso' : 'Access Requirements'}</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{isEs ? 'Identificación' : 'ID Requirement'}</span>
                <span className={`text-sm font-medium ${s.id_required ? 'text-amber-600' : 'text-[#2D8C7A]'}`}>
                  {s.id_required ? (isEs ? 'Se requiere ID' : 'ID Required') : (isEs ? 'Sin ID requerida' : 'No ID Required')}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{isEs ? 'Idiomas Disponibles' : 'Languages Served'}</span>
                <div className="flex gap-1">
                  {s.languages.map((l) => (
                    <Badge key={l} variant="outline" className="text-xs">
                      {isEs ? (l === 'es' ? 'Español' : 'Inglés') : l.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{isEs ? 'Tipo de Alimentos' : 'Cold Storage'}</span>
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {s.cold_storage_type === 'none'
                    ? (isEs ? 'Solo no perecederos' : 'Non-perishable only')
                    : (isEs ? 'Incluye frescos' : s.cold_storage_type)}
                </span>
              </div>
              {s.notes && (
                <div className="pt-2">
                  <span className="text-sm text-gray-500">{s.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Transit — cached legacy stops */}
          {transit && transit.stops.length > 0 && liveTransit.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Bus className="h-5 w-5 text-[#2D8C7A]" />
                <h2 className="text-lg font-semibold text-gray-900">{isEs ? 'Paradas de Autobús Cercanas' : 'Nearby Bus Stops'}</h2>
              </div>
              <div className="space-y-2">
                {transit.stops.slice(0, 5).map((stop: SiteTransitStop) => (
                  <div key={stop.stop_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{stop.name}</p>
                      <p className="text-xs text-gray-400">Routes: {stop.routes.join(', ')}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {Math.round(stop.distance_m)}m away
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transit — live KCATA data from challenge API */}
          {liveTransit.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bus className="h-5 w-5 text-[#2D8C7A]" />
                  <h2 className="text-lg font-semibold text-gray-900">Getting Here by Bus</h2>
                </div>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">KCATA</span>
              </div>
              <div className="space-y-3">
                {liveTransit.slice(0, 4).map((stop) => (
                  <div key={stop.stopId} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{stop.route}</p>
                        <div className="flex flex-wrap gap-3 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Navigation className="h-3 w-3 text-[#2D8C7A]" />
                            {stop.walkMinutes} min walk
                          </span>
                          <span className="text-xs text-gray-500">Every {stop.frequency}</span>
                          <span className="text-xs text-gray-500">{stop.operatingHours}</span>
                        </div>
                      </div>
                      <a
                        href={`https://www.kcata.org/maps_schedules/route/${encodeURIComponent(stop.route.split(' - ')[0])}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs text-[#2D8C7A] hover:text-[#1B3A52] font-medium"
                      >
                        Schedule →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              {s.address && (
                <a
                  href={`https://www.kcata.org/trip-planner?destination=${encodeURIComponent(s.address + ', Kansas City, MO')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full rounded-lg border border-[#2D8C7A] text-[#2D8C7A] hover:bg-[#2D8C7A] hover:text-white transition-colors px-4 py-2.5 text-sm font-medium"
                >
                  <Bus className="h-4 w-4" />
                  {isEs ? 'Planificar mi viaje en autobús' : 'Plan my bus trip'}
                </a>
              )}
            </div>
          )}

          {/* No transit info — encourage walking directions */}
          {hasNoTransitCache && liveTransit.length === 0 && s.address && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bus className="h-5 w-5 text-gray-400" />
                <h2 className="text-base font-semibold text-gray-700">{isEs ? 'Autobús y Tránsito' : 'Bus & Transit'}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                {isEs ? 'Rutas de tránsito no cargadas. Usa el planificador de viajes de KCATA.' : 'Transit routes not loaded yet. Use the KCATA trip planner for real-time options.'}
              </p>
              <a
                href={`https://www.kcata.org/trip-planner?destination=${encodeURIComponent(s.address + ', Kansas City, MO')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#2D8C7A] hover:underline font-medium"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                KCATA Trip Planner
              </a>
            </div>
          )}

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <div className="rounded-2xl border border-[#2D8C7A]/20 bg-[#E8F5F2] p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{isEs ? 'Próximos Eventos' : 'Upcoming Events'}</h2>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="rounded-xl bg-white border border-[#2D8C7A]/30 p-4">
                    <p className="font-medium text-gray-900">{event.description ?? event.lead_org ?? ''}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(event.scheduled_at).toLocaleDateString('en-US', {
                        weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                    {event.description && <p className="text-sm text-gray-500 mt-1">{event.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Need score */}
          {ns && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{isEs ? `Necesidad Comunitaria — ZIP ${s.zip}` : `Community Need — ZIP ${s.zip}`}</h3>
              <NeedScoreBadge score={ns.need_score ?? 0} size="md" />
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{isEs ? 'Tasa de Pobreza' : 'Poverty Rate'}</span>
                  <span className="font-medium text-gray-700">{ns.poverty_rate}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{isEs ? 'Sin Vehículo' : 'No Vehicle'}</span>
                  <span className="font-medium text-gray-700">{ns.no_car_pct}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{isEs ? 'Hispano/Latino' : 'Hispanic/Latino'}</span>
                  <span className="font-medium text-gray-700">{ns.hispanic_pct}%</span>
                </div>
                {ns.food_desert && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    {isEs ? 'Zona de Desierto Alimentario (USDA)' : 'USDA Food Desert Zone'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {isEs ? '¿Necesitas ayuda para llegar?' : 'Need help getting here?'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {isEs
                ? 'Podemos ayudarte con transporte, asistencia de idioma u otro apoyo.'
                : 'We can help connect you with transportation, language assistance, or other support.'}
            </p>
            <Link
              href={`/request-help?site_id=${s.id}`}
              className="block w-full rounded-lg bg-[#F5A623] px-4 py-2.5 text-center text-sm font-semibold text-[#1B3A52] hover:bg-[#e09520] transition-colors"
            >
              {isEs ? 'Solicitar Ayuda Para Llegar' : 'Request Help Getting Here'}
            </Link>
          </div>

          {/* Bilingual info for ES sites */}
          {hasSpanish && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="text-sm font-bold text-blue-900 mb-1">Información en Español</h3>
              <p className="text-xs text-blue-700">
                Este sitio ofrece asistencia en español.{!s.id_required && ' No necesitas traer identificación.'}
              </p>
              <div className="mt-3 text-xs text-blue-600">
                <p><strong>Horario:</strong> {s.hours_raw}</p>
                <p className="mt-1"><strong>Idiomas:</strong> {s.languages.map(l => l === 'es' ? 'Español' : 'Inglés').join(', ')}</p>
              </div>
            </div>
          )}

          {/* Listen in Spanish — available on every site */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {isEs ? 'Escuchar en español' : 'Listen in Spanish'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {isEs
                ? 'Escucha los detalles de este sitio — horario, dirección y requisitos — en voz alta.'
                : 'Hear this site\'s details — hours, address, and requirements — read aloud in Spanish.'}
            </p>
            <SpeakButton
              text={buildSpanishNarration(s)}
              label="Escuchar información en español"
              className="w-full justify-center"
            />
          </div>

          {/* Google Maps link */}
          {s.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(s.address + ', Kansas City, MO')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 hover:border-blue-300 hover:text-blue-700 transition-colors shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
              {isEs ? 'Abrir en Google Maps' : 'Open in Google Maps'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
