'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Clock, Star, Zap, Search, ChevronDown } from 'lucide-react';
import { RESTAURANTS } from '@/lib/delivery/mock-data';

const CATEGORIES = ['All', 'Pizza', 'BBQ', 'Mexican', 'Asian', 'Bakery', 'Fine Dining'];

export default function RestaurantsPage() {
  const [user, setUser] = useState<{ name: string; address: string } | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [surgeActive, setSurgeActive] = useState(false);
  const [showSurgeBanner, setShowSurgeBanner] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('sd_user');
    if (stored) setUser(JSON.parse(stored));
    // Simulate surge after 5s for demo
    const t = setTimeout(() => setSurgeActive(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const filtered = RESTAURANTS.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'All' || r.category === category;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ background: '#FAFAFA', minHeight: '100vh' }}>
      {/* Top nav */}
      <div style={{ background: '#0F172A' }} className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/delivery" className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xl">⚡</span>
            <span className="font-black text-white text-lg">SwiftDrop</span>
          </Link>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search restaurants or cuisine…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/20 pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-white/70">
            <MapPin className="h-3.5 w-3.5 text-orange-400" />
            <span className="hidden sm:inline truncate max-w-[140px]">{user?.address ?? 'Set address'}</span>
          </div>
        </div>
      </div>

      {/* Surge Banner */}
      {surgeActive && showSurgeBanner && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white"
          style={{ background: 'linear-gradient(90deg, #DC2626, #EA580C)' }}>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 flex-shrink-0" />
            <span><strong>Surge pricing active</strong> — High demand in your area. Delivery fees temporarily increased 1.5×.</span>
          </div>
          <button onClick={() => setShowSurgeBanner(false)} className="flex-shrink-0 text-white/70 hover:text-white text-lg leading-none">×</button>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Address + greeting */}
        <div className="mb-5">
          <h1 className="text-2xl font-black text-gray-900">
            {user ? `Hey ${user.name.split(' ')[0]}! 👋` : 'What are you craving?'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            Delivering to <strong className="ml-1 text-gray-700">{user?.address ?? '—'}</strong>
            <button className="ml-1 text-orange-500 font-medium hover:underline flex items-center gap-0.5">
              Change <ChevronDown className="h-3 w-3" />
            </button>
          </p>
        </div>

        {/* Surge toggle for demo */}
        <div className="mb-5 flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed"
          style={{ borderColor: surgeActive ? '#DC2626' : '#D1D5DB', background: surgeActive ? '#FEF2F2' : '#F9FAFB' }}>
          <Zap className={`h-5 w-5 flex-shrink-0 ${surgeActive ? 'text-red-600' : 'text-gray-400'}`} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${surgeActive ? 'text-red-800' : 'text-gray-700'}`}>
              {surgeActive ? '🔴 Surge Pricing Active — 1.5× delivery fees' : '⚪ Normal pricing — No surge'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Toggle to simulate demand spikes</p>
          </div>
          <button
            onClick={() => setSurgeActive(!surgeActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${surgeActive ? 'bg-red-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${surgeActive ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                category === c
                  ? 'text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
              style={category === c ? { background: '#F97316' } : {}}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Restaurant grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const fee = surgeActive ? (r.deliveryFee * 1.5).toFixed(2) : r.deliveryFee.toFixed(2);
            return (
              <Link
                key={r.id}
                href={`/delivery/restaurant/${r.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden"
              >
                {/* Cover */}
                <div className="h-32 flex items-center justify-center text-6xl"
                  style={{ background: 'linear-gradient(135deg, #1E293B, #334155)' }}>
                  {r.emoji}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 leading-tight">{r.name}</h3>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-bold text-gray-700">{r.rating}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{r.category} · {r.reviews} reviews</p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="h-3.5 w-3.5" />
                      {r.deliveryTime} min
                    </div>
                    <div className={`font-semibold ${surgeActive ? 'text-red-600' : 'text-gray-700'}`}>
                      {surgeActive && <span className="line-through text-gray-400 mr-1">${r.deliveryFee.toFixed(2)}</span>}
                      ${fee} delivery
                      {surgeActive && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1 rounded">Surge</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {r.tags.map((t) => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{t}</span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🍽️</p>
            <p>No restaurants match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
