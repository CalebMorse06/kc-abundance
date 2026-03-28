export const dynamic = 'force-dynamic';

import React from 'react';
import Link from 'next/link';
import {
  MapPin, HelpCircle, Users, ArrowRight,
  LayoutDashboard, CheckCircle, Clock, Globe,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { AbundanceSpinner } from '@/components/AbundanceSpinner';

async function getHomeData() {
  const supabase = await createClient();
  const [{ data: sites }, { data: popups }, { data: votes }] = await Promise.all([
    supabase.from('sites').select('id, zip, name').eq('active', true),
    supabase
      .from('popup_events')
      .select('id, scheduled_at, zip, description')
      .in('status', ['planned', 'active'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(2),
    supabase
      .from('community_votes')
      .select('id, title, title_es, support_count, target_count, zip, deadline')
      .eq('active', true)
      .limit(2),
  ]);
  return {
    siteCount: sites?.length ?? 0,
    popupCount: popups?.length ?? 0,
    upcomingPopups: popups ?? [],
    activeVote: votes?.[0] ?? null,
    allVotes: votes ?? [],
  };
}

export default async function HomePage() {
  const { siteCount, popupCount, upcomingPopups, activeVote, allVotes } = await getHomeData();
  const voteProgress = activeVote
    ? Math.min(100, Math.round((activeVote.support_count / activeVote.target_count) * 100))
    : 67;
  const voteCount = activeVote?.support_count ?? 67;
  const voteTarget = activeVote?.target_count ?? 100;

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #0F1F2E 0%, #1B3A52 45%, #1e4035 100%)',
          minHeight: '560px',
        }}
      >
        {/* Background texture */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.07]"
            style={{ background: 'var(--brand-orange)' }} />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full opacity-[0.04]"
            style={{ background: 'var(--brand-teal)' }} />
          {/* Wave transition to next section */}
          <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 80"
            preserveAspectRatio="none" style={{ height: '64px' }}>
            <path d="M0,40 C320,80 640,0 960,50 C1120,70 1300,30 1440,45 L1440,80 L0,80 Z"
              fill="var(--background)" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: headline + CTAs */}
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold mb-6"
                style={{ background: 'rgba(245,166,35,0.15)', color: 'var(--brand-orange)', border: '1px solid rgba(245,166,35,0.28)' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                Serving Kansas City families
              </div>

              <h1
                className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight"
                style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}
              >
                Free food is closer
                <br />
                <span style={{ color: 'var(--brand-orange)' }}>than you think.</span>
              </h1>
              <p className="mt-2 text-base italic" style={{ color: 'rgba(255,255,255,0.72)' }}>
                Los alimentos gratuitos están más cerca de lo que crees.
              </p>

              <p className="mt-5 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                Find pantries, food banks, and community popups near you —
                no account, no paperwork, no judgment.
                Available in English and Spanish.
              </p>

              <a
                href="/abundance-kc-writeup.html"
                download="abundance-kc-writeup.html"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:underline"
                style={{ color: 'rgba(255,255,255,0.5)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download technical writeup
              </a>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/map"
                  className="inline-flex items-center justify-center gap-2.5 rounded-xl px-7 py-4 text-base font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
                  style={{ background: 'var(--brand-orange)', color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
                >
                  <MapPin className="h-5 w-5" />
                  Find Food Near Me
                </Link>
                <Link
                  href="/request-help"
                  className="inline-flex items-center justify-center gap-2.5 rounded-xl px-7 py-4 text-base font-semibold transition-all hover:-translate-y-0.5"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  <HelpCircle className="h-5 w-5" />
                  Request Delivery Help
                </Link>
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>
                <Globe className="h-3.5 w-3.5" />
                <span>Ayuda disponible en español — busca el ícono ES en los sitios</span>
              </div>
            </div>

            {/* Right: live snapshot cards */}
            <div className="hidden lg:flex flex-col gap-3">
              {/* Site count card */}
              <div
                className="rounded-2xl p-5 flex items-center gap-4"
                style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.20)' }}
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(245,166,35,0.18)' }}
                >
                  <MapPin className="h-6 w-6" style={{ color: 'var(--brand-orange)' }} />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-white" style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                    {siteCount > 0 ? `${siteCount}` : '12'} food sites
                  </div>
                  <div className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    active across Kansas City
                  </div>
                </div>
              </div>

              {/* Upcoming popup */}
              {upcomingPopups.length > 0 ? (
                <div
                  className="rounded-2xl p-5 flex items-center gap-4"
                  style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.20)' }}
                >
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(45,140,122,0.22)' }}
                  >
                    <Clock className="h-6 w-6" style={{ color: 'var(--brand-teal-mid)' }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Next popup: ZIP {upcomingPopups[0].zip ?? '64105'}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
                      {new Date(upcomingPopups[0].scheduled_at).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-2xl p-5 flex items-center gap-4"
                  style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.20)' }}
                >
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(45,140,122,0.22)' }}>
                    <Clock className="h-6 w-6" style={{ color: 'var(--brand-teal-mid)' }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">2 upcoming popups</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
                      in high-need neighborhoods this week
                    </div>
                  </div>
                </div>
              )}

              {/* Community vote */}
              <div
                className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.20)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-white">Community vote in progress</div>
                  <div className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,166,35,0.2)', color: 'var(--brand-orange)' }}>
                    LIVE
                  </div>
                </div>
                <div className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {activeVote?.title_es ?? 'Apoya un mercado semanal en tu vecindario'}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${voteProgress}%`, background: 'var(--brand-orange)' }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>{voteCount} supporters</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>goal: {voteTarget}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <section className="py-8 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center divide-x" style={{ color: 'var(--border)' }}>
            {[
              { value: `${siteCount > 0 ? siteCount : 12}+`, label: 'Food Sites', note: 'pantries, banks & mobile' },
              { value: `${popupCount > 0 ? popupCount : 2}`, label: 'Active Popups', note: 'in your neighborhood' },
              { value: '12', label: 'ZIP Codes', note: 'tracked for food access' },
              { value: `${voteCount}/${voteTarget}`, label: 'Community Votes', note: 'for next popup location' },
            ].map(({ value, label, note }) => (
              <div key={label} className="px-4">
                <div
                  className="text-3xl font-extrabold"
                  style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
                >
                  {value}
                </div>
                <div className="text-sm font-semibold mt-0.5" style={{ color: 'var(--brand-navy)' }}>{label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How we help ───────────────────────────────────────────── */}
      <section className="py-16" style={{ background: 'var(--background)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
            >
              We&apos;re here to help
            </h2>
            <p className="mt-1 text-sm italic" style={{ color: '#9CA3AF' }}>
              Estamos aquí para ayudar
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: MapPin,
                color: 'var(--brand-teal)',
                bg: '#E8F5F2',
                title: 'Find a Pantry or Popup',
                titleEs: 'Encuentra una despensa o mercado',
                desc: 'Search by ZIP to find food near you. Filter by open now, no ID required, Spanish-speaking staff, or bus-accessible.',
                cta: 'Search food near me',
                href: '/map',
              },
              {
                icon: HelpCircle,
                color: 'var(--brand-sky)',
                bg: '#EBF4FB',
                title: 'Get Delivery Help',
                titleEs: 'Obtén ayuda a domicilio',
                desc: 'No car? Can\'t leave home? Submit a request and we\'ll connect you with a delivery or volunteer near you.',
                cta: 'Request assistance',
                href: '/request-help',
              },
              {
                icon: Users,
                color: 'var(--brand-orange)',
                bg: 'var(--brand-orange-faint)',
                title: 'Support Your Neighborhood',
                titleEs: 'Apoya tu vecindario',
                desc: 'Vote to bring a weekly popup market to your ZIP code. The Columbus Park vote is 67% of the way there.',
                cta: 'Cast your support',
                href: '/community/64105',
              },
            ].map(({ icon: Icon, color, bg, title, titleEs, desc, cta, href }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-2xl bg-white p-7 flex flex-col gap-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
                style={{ border: '1px solid var(--border)' }}
              >
                <div
                  className="inline-flex h-13 w-13 items-center justify-center rounded-xl h-12 w-12"
                  style={{ background: bg, color }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                    {title}
                  </h3>
                  <p className="text-xs italic mt-0.5" style={{ color: '#9CA3AF' }}>{titleEs}</p>
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: '#4B5563' }}>{desc}</p>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-sm font-semibold group-hover:gap-2.5 transition-all" style={{ color }}>
                  {cta} <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="py-14" style={{ background: 'var(--muted)' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2
              className="text-2xl font-bold"
              style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
            >
              It only takes a minute
            </h2>
            <p className="text-sm italic mt-1" style={{ color: '#9CA3AF' }}>
              Solo toma un minuto
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Enter your ZIP',
                titleEs: 'Ingresa tu código postal',
                desc: 'Type in your ZIP code or let us use your location. No account needed.',
              },
              {
                step: '2',
                title: 'Find what fits you',
                titleEs: 'Encuentra lo que te conviene',
                desc: 'Filter by hours, ID requirements, language, or whether fresh produce is available today.',
              },
              {
                step: '3',
                title: 'Show up or get help',
                titleEs: 'Ve o solicita ayuda',
                desc: 'Visit the site directly, or submit a help request if you need delivery or have barriers.',
              },
            ].map(({ step, title, titleEs, desc }) => (
              <div key={step} className="flex flex-col items-center text-center gap-4">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0"
                  style={{ background: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
                >
                  {step}
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                    {title}
                  </h3>
                  <p className="text-xs italic mt-0.5" style={{ color: '#9CA3AF' }}>{titleEs}</p>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: '#4B5563' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md"
              style={{ background: 'var(--brand-navy)', color: 'white', fontFamily: 'var(--font-jakarta, sans-serif)' }}
            >
              <MapPin className="h-4 w-4" />
              Find food in my neighborhood
            </Link>
          </div>
        </div>
      </section>

      {/* ── Community vote callout ─────────────────────────────────── */}
      <section className="py-14" style={{ background: 'var(--background)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-3"
              style={{ background: 'rgba(245,166,35,0.12)', color: 'var(--brand-orange)', border: '1px solid rgba(245,166,35,0.25)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              {allVotes.length} active community campaign{allVotes.length !== 1 ? 's' : ''} · Campañas activas
            </div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
              Your neighborhood needs a voice
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {allVotes.map((v) => {
              const pct = Math.min(100, Math.round((v.support_count / v.target_count) * 100));
              const zipNames: Record<string, string> = { '64105': 'Columbus Park', '64127': 'Eastside' };
              const name = zipNames[v.zip ?? ''] ?? `ZIP ${v.zip}`;
              return (
                <div
                  key={v.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, var(--brand-navy) 0%, #1e4035 100%)' }}
                >
                  <div className="p-6 sm:p-8">
                    <div className="text-xs font-semibold mb-3" style={{ color: 'var(--brand-orange)' }}>
                      ZIP {v.zip} · {name}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                      {v.title}
                    </h3>
                    {v.title_es && (
                      <p className="text-sm italic mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>{v.title_es}</p>
                    )}
                    <div className="mb-5">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-2xl font-extrabold text-white">{v.support_count.toLocaleString()}</span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>of {v.target_count} needed</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-orange)' }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{pct}% of goal</span>
                        <span className="text-xs font-medium" style={{ color: 'var(--brand-orange)' }}>
                          {v.target_count - v.support_count} more to activate
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/community/${v.zip}`}
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all hover:-translate-y-0.5 shadow-lg"
                      style={{ background: 'var(--brand-orange)', color: 'var(--brand-navy)' }}
                    >
                      <Users className="h-4 w-4" />
                      Add my support · Apoyar
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Neighborhoods ─────────────────────────────────────────── */}
      <section className="py-12" style={{ background: 'var(--muted)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2
              className="text-xl font-bold"
              style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
            >
              Where we focus
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
              High-need Kansas City neighborhoods with food access gaps
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { zip: '64101', note: 'Downtown',     stat: '44.6% poverty' },
              { zip: '64105', note: 'Columbus Park', stat: '71% Spanish-speaking', highlight: true },
              { zip: '64127', note: 'Eastside',     stat: 'Store closed 2024' },
              { zip: '64128', note: 'Swope Park',   stat: '33.7% poverty' },
              { zip: '64130', note: 'Troost Corr.', stat: '18,700 impacted' },
              { zip: '64132', note: 'South KC',     stat: '21.4% food insec.' },
            ].map((z) => (
              <Link
                key={z.zip}
                href={`/map?zip=${z.zip}`}
                className="rounded-xl p-3.5 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm"
                style={z.highlight
                  ? { background: 'var(--brand-orange-faint)', border: '1px solid rgba(245,166,35,0.45)' }
                  : { background: 'white', border: '1px solid var(--border)' }
                }
              >
                <div className="text-lg font-extrabold" style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                  {z.zip}
                </div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: z.highlight ? '#92400E' : '#6B7280' }}>
                  {z.note}
                </div>
                <div className="text-xs mt-1.5 leading-tight" style={{ color: z.highlight ? '#B45309' : '#9CA3AF' }}>
                  {z.stat}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's available ──────────────────────────────────────── */}
      <section className="py-12 bg-white border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: CheckCircle, color: '#16A34A', label: 'No account required', note: 'Browse and find food anonymously' },
              { icon: Globe, color: 'var(--brand-sky)', label: 'English & Spanish', note: 'Bilingual support at every step' },
              { icon: HelpCircle, color: 'var(--brand-orange)', label: 'Delivery available', note: 'For families who can\'t travel' },
            ].map(({ icon: Icon, color, label, note }) => (
              <div key={label} className="flex items-center gap-4 justify-center sm:justify-start p-4 rounded-xl"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <Icon className="h-6 w-6 flex-shrink-0" style={{ color }} />
                <div className="text-left">
                  <div className="text-sm font-semibold" style={{ color: 'var(--brand-navy)' }}>{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Operator section ──────────────────────────────────────── */}
      <section className="py-12" style={{ background: 'var(--muted)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between"
            style={{ background: 'white', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--brand-navy-faint)' }}
              >
                <LayoutDashboard className="h-6 w-6" style={{ color: 'var(--brand-navy)' }} />
              </div>
              <div>
                <div className="font-bold" style={{ color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
                  Are you a food bank or distribution operator?
                </div>
                <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
                  Route food to sites that can use it, track produce with 48hr spoilage windows, plan popups in high-need ZIPs.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all hover:-translate-y-0.5 whitespace-nowrap flex-shrink-0"
              style={{ background: 'var(--brand-navy)', color: 'white', fontFamily: 'var(--font-jakarta, sans-serif)' }}
            >
              <LayoutDashboard className="h-4 w-4" />
              Operator Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Brand bar ─────────────────────────────────────────────── */}
      <section
        className="py-10 text-center"
        style={{ background: 'var(--brand-navy)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <AbundanceSpinner size={40} strokeWidth={7} />
          <div
            className="text-xl font-extrabold text-white"
            style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}
          >
            Abundance-KC
          </div>
          <p className="text-sm max-w-md" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Connecting Kansas City families with food — and giving operators the tools
            to make every pound count.
          </p>
          <Link
            href="/map"
            className="mt-2 inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-white"
            style={{ color: 'var(--brand-orange)' }}
          >
            Find food now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
