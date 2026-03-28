'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Zap, Clock, Shield } from 'lucide-react';

export default function DeliveryLandingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [step, setStep] = useState<'landing' | 'onboard'>('landing');

  const handleStart = () => {
    if (!name.trim() || !address.trim()) return;
    localStorage.setItem('sd_user', JSON.stringify({ name: name.trim(), address: address.trim() }));
    router.push('/delivery/restaurants');
  };

  if (step === 'onboard') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="text-4xl">⚡</span>
              <span className="text-3xl font-black text-white">SwiftDrop</span>
            </div>
            <p className="text-slate-400">Tell us where to deliver</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Name</label>
              <input
                type="text"
                placeholder="Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Delivery Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="1234 Main St, Kansas City, MO"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
            <button
              onClick={handleStart}
              disabled={!name.trim() || !address.trim()}
              className="w-full rounded-xl py-3.5 text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: '#F97316', color: '#fff' }}
            >
              Find Food Near Me →
            </button>
            <p className="text-center text-xs text-gray-400">No account needed · Demo mode</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0F172A' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-xl font-black text-white">SwiftDrop</span>
        </div>
        <button
          onClick={() => setStep('onboard')}
          className="rounded-lg px-4 py-2 text-sm font-semibold border border-white/20 text-white hover:bg-white/10 transition-colors"
        >
          Log in
        </button>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold" style={{ background: '#F97316', color: '#fff' }}>
          <Zap className="h-3.5 w-3.5" /> Kansas City&apos;s Fastest Local Delivery
        </div>

        <h1 className="text-5xl sm:text-7xl font-black text-white leading-tight mb-6">
          KC food.<br />
          <span style={{ color: '#F97316' }}>Your door.</span><br />
          25 minutes.
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
          Real KC restaurants. Real local drivers. No corporate middlemen.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setStep('onboard')}
            className="rounded-2xl px-8 py-4 text-base font-bold transition-all hover:scale-105"
            style={{ background: '#F97316', color: '#fff' }}
          >
            Order Now — It&apos;s Free →
          </button>
          <button
            onClick={() => setStep('onboard')}
            className="rounded-2xl px-8 py-4 text-base font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
          >
            View restaurants
          </button>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          {[
            { n: '47', label: 'Local restaurants' },
            { n: '22min', label: 'Average delivery' },
            { n: '4.9★', label: 'Driver rating' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black text-white">{s.n}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ background: '#1E293B' }} className="py-16">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { icon: Zap, title: 'Lightning Fast', desc: 'Most deliveries under 30 minutes. Real-time GPS tracking.' },
            { icon: MapPin, title: 'Hyper-Local', desc: 'We only work with restaurants within 5 miles of you.' },
            { icon: Shield, title: 'No Hidden Fees', desc: 'Flat delivery fee. No service fees. No surprises at checkout.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4" style={{ background: '#F9731620' }}>
                <Icon className="h-5 w-5" style={{ color: '#F97316' }} />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-16 px-6">
        <h2 className="text-3xl font-black text-white mb-4">Ready to order?</h2>
        <button
          onClick={() => setStep('onboard')}
          className="rounded-2xl px-8 py-4 text-base font-bold"
          style={{ background: '#F97316', color: '#fff' }}
        >
          Get Started →
        </button>
      </div>

      <footer className="border-t border-white/10 py-6 text-center text-slate-500 text-xs px-6">
        SwiftDrop · Kansas City, MO · Demo Build · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
