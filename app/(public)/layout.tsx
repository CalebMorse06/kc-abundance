import React from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Menu, LayoutDashboard } from 'lucide-react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { AbundanceSpinner } from '@/components/AbundanceSpinner';
import { LangProviderWrapper } from '@/components/LangProviderWrapper';
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isEs = cookieStore.get('lang')?.value === 'es';
  return (
    <LangProviderWrapper>
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* ── Top navigation ─────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-sm shadow-md"
        style={{ background: 'rgba(27,58,82,0.97)' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <AbundanceSpinner size={32} strokeWidth={7} />
              <div>
                <span
                  className="text-lg font-extrabold leading-none tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}
                >
                  Abundance
                </span>
                <span
                  className="text-lg font-extrabold leading-none tracking-tight"
                  style={{ color: 'var(--brand-orange)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
                >
                  -KC
                </span>
              </div>
            </Link>

            {/* Nav links */}
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/map"
                className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}
              >
                {isEs ? 'Encontrar Comida' : 'Find Food'}
              </Link>
              <Link
                href="/request-help"
                className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.8)' }}
              >
                {isEs ? 'Solicitar Ayuda' : 'Request Help'}
              </Link>

              {/* Divider */}
              <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.15)' }} />

              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Operator Login
              </Link>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <Link
                href="/request-help"
                className="hidden sm:inline-flex items-center rounded-lg px-4 py-2 text-sm font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-px"
                style={{
                  background: 'var(--brand-orange)',
                  color: 'var(--brand-navy)',
                  fontFamily: 'var(--font-jakarta, sans-serif)',
                }}
              >
                {isEs ? 'Obtener Ayuda' : 'Get Help'}
              </Link>
              <button
                className="sm:hidden flex items-center justify-center h-9 w-9 rounded-lg border"
                style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--brand-navy)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <AbundanceSpinner size={28} strokeWidth={7} />
              <div>
                <div
                  className="text-base font-bold text-white"
                  style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}
                >
                  Abundance-KC
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Serving Kansas City families
                </div>
              </div>
            </div>

            {/* Links */}
            <nav className="flex items-center gap-6 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <Link href="/map"          className="hover:text-white transition-colors">{isEs ? 'Encontrar Comida' : 'Find Food'}</Link>
              <Link href="/request-help" className="hover:text-white transition-colors">{isEs ? 'Obtener Ayuda' : 'Get Help'}</Link>
              <Link href="/community/64105" className="hover:text-white transition-colors">{isEs ? 'Comunidad' : 'Community'}</Link>
              <Link href="/login"         className="hover:text-white transition-colors">Operator</Link>
            </nav>
          </div>

          <div
            className="mt-8 pt-6 text-xs"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
          >
            © {new Date().getFullYear()} Abundance-KC · Kansas City, MO · Built for community
          </div>
        </div>
      </footer>
    </div>
    </LangProviderWrapper>
  );
}
