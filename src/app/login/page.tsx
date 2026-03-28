'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AbundanceSpinner } from '@/components/AbundanceSpinner';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/dashboard');
  }

  async function handleStaffAccess() {
    setQuickLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: 'demo-operator@foodbridgekc.org',
      password: 'demo1234',
    });
    if (error) {
      setError(error.message);
      setQuickLoading(false);
      return;
    }
    router.push('/dashboard');
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(155deg, #0F1F2E 0%, #1B3A52 60%, #1e4035 100%)' }}
    >
      {/* Back to site */}
      <div className="w-full max-w-sm mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-white"
          style={{ color: 'rgba(255,255,255,0.50)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to site
        </Link>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <AbundanceSpinner size={44} strokeWidth={7} />
          <div className="text-center">
            <div
              className="text-lg font-extrabold text-white"
              style={{ fontFamily: 'var(--font-jakarta, sans-serif)' }}
            >
              Abundance<span style={{ color: 'var(--brand-orange)' }}>-KC</span>
            </div>
            <div className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.50)' }}>
              Staff sign in
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organization.org"
              required
              className="rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--brand-orange)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--brand-orange)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(220,38,38,0.15)', color: '#FCA5A5', border: '1px solid rgba(220,38,38,0.3)' }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || quickLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--brand-orange)', color: 'var(--brand-navy)', fontFamily: 'var(--font-jakarta, sans-serif)' }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        {/* Quick staff access */}
        <button
          onClick={handleStaffAccess}
          disabled={loading || quickLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {quickLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Access operator dashboard'}
        </button>
      </div>

      {/* Resident note */}
      <p className="mt-6 text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
        Looking for food?{' '}
        <Link href="/map" className="underline transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Find sites near you
        </Link>
      </p>
    </div>
  );
}
