'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Clock, Phone, MessageSquare, Star } from 'lucide-react';

const STAGES = [
  { id: 'confirmed', label: 'Order Confirmed', sub: 'Restaurant received your order', progress: 0, emoji: '✅' },
  { id: 'preparing', label: 'Preparing Your Food', sub: 'Kitchen is working on it', progress: 25, emoji: '👨‍🍳' },
  { id: 'picked_up', label: 'Driver Picked Up', sub: 'On the way to you', progress: 55, emoji: '🛵' },
  { id: 'arriving', label: 'Almost There!', sub: '2 minutes away', progress: 85, emoji: '📍' },
  { id: 'delivered', label: 'Delivered!', sub: 'Enjoy your meal 🎉', progress: 100, emoji: '🎉' },
];

// SVG path points for truck animation (normalized 0-100 coordinates)
const TRUCK_PATH = [
  { x: 15, y: 70 },  // Restaurant location
  { x: 25, y: 65 },
  { x: 40, y: 60 },
  { x: 50, y: 55 },
  { x: 60, y: 50 },
  { x: 70, y: 45 },
  { x: 78, y: 55 },  // Turn
  { x: 82, y: 65 },  // Home location
];

function interpolate(path: typeof TRUCK_PATH, progress: number) {
  const t = progress / 100;
  const totalSegments = path.length - 1;
  const segment = Math.min(Math.floor(t * totalSegments), totalSegments - 1);
  const segmentT = t * totalSegments - segment;
  const a = path[segment];
  const b = path[segment + 1];
  return {
    x: a.x + (b.x - a.x) * segmentT,
    y: a.y + (b.y - a.y) * segmentT,
  };
}

function TrackingContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order') ?? 'SD-DEMO';

  const [stageIndex, setStageIndex] = useState(0);
  const [truckProgress, setTruckProgress] = useState(0);
  const [eta, setEta] = useState(28);
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(0);

  const stage = STAGES[stageIndex];
  const delivered = stageIndex === STAGES.length - 1;

  useEffect(() => {
    if (delivered) return;

    // Advance through stages
    const stageTimings = [2000, 6000, 5000, 4000];
    let currentStage = 0;

    const advance = () => {
      currentStage++;
      if (currentStage < STAGES.length) {
        setStageIndex(currentStage);
      }
    };

    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (const timing of stageTimings) {
      elapsed += timing;
      timers.push(setTimeout(advance, elapsed));
    }

    // Smooth truck animation
    const start = Date.now();
    const duration = stageTimings.reduce((a, b) => a + b, 0);
    const animate = () => {
      const p = Math.min(((Date.now() - start) / duration) * 100, 100);
      setTruckProgress(p);
      setEta(Math.max(0, Math.round(28 * (1 - p / 100))));
      if (p < 100) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    return () => timers.forEach(clearTimeout);
  }, [delivered]);

  const truckPos = interpolate(TRUCK_PATH, truckProgress);

  return (
    <div style={{ background: '#FAFAFA', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#0F172A' }} className="sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-black text-white">SwiftDrop</span>
          </div>
          <p className="text-xs text-white/50 font-mono">{orderId}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">

        {/* Status card */}
        <div className={`rounded-2xl p-5 text-center transition-all ${delivered ? 'bg-green-50 border-2 border-green-200' : 'bg-white border border-gray-100 shadow-sm'}`}>
          <div className="text-4xl mb-2">{stage.emoji}</div>
          <h2 className={`text-xl font-black mb-1 ${delivered ? 'text-green-800' : 'text-gray-900'}`}>
            {stage.label}
          </h2>
          <p className="text-sm text-gray-500">{stage.sub}</p>
          {!delivered && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-orange-600 font-semibold text-sm">
              <Clock className="h-4 w-4" />
              ETA: ~{eta} min
            </div>
          )}
        </div>

        {/* Map simulation */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Live Tracking</h3>
            {!delivered && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {/* SVG Map */}
          <div className="relative bg-slate-100" style={{ height: 200 }}>
            <svg viewBox="0 0 100 100" className="w-full h-full" style={{ background: '#E2E8F0' }}>
              {/* Street grid */}
              {[20, 35, 50, 65, 80].map((x) => (
                <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" stroke="#CBD5E1" strokeWidth="0.5" />
              ))}
              {[20, 35, 50, 65, 80].map((y) => (
                <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="#CBD5E1" strokeWidth="0.5" />
              ))}

              {/* Main roads */}
              <line x1="0" y1="65" x2="80" y2="65" stroke="#94A3B8" strokeWidth="1.5" />
              <line x1="50" y1="0" x2="50" y2="100" stroke="#94A3B8" strokeWidth="1.5" />

              {/* Route line */}
              <polyline
                points={TRUCK_PATH.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#F97316"
                strokeWidth="1.5"
                strokeDasharray="3,2"
                opacity="0.6"
              />

              {/* Driven path */}
              {truckProgress > 0 && (() => {
                const drivenPoints = [];
                for (let i = 0; i <= truckProgress; i += 5) {
                  const pt = interpolate(TRUCK_PATH, i);
                  drivenPoints.push(`${pt.x},${pt.y}`);
                }
                drivenPoints.push(`${truckPos.x},${truckPos.y}`);
                return (
                  <polyline
                    points={drivenPoints.join(' ')}
                    fill="none"
                    stroke="#F97316"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                );
              })()}

              {/* Restaurant pin */}
              <circle cx={TRUCK_PATH[0].x} cy={TRUCK_PATH[0].y} r="3" fill="#0F172A" />
              <text x={TRUCK_PATH[0].x + 2} y={TRUCK_PATH[0].y - 4} fontSize="4" fill="#0F172A" fontWeight="bold">Rest.</text>

              {/* Home pin */}
              <circle cx={TRUCK_PATH[TRUCK_PATH.length - 1].x} cy={TRUCK_PATH[TRUCK_PATH.length - 1].y} r="3" fill="#16A34A" />
              <text x={TRUCK_PATH[TRUCK_PATH.length - 1].x - 8} y={TRUCK_PATH[TRUCK_PATH.length - 1].y - 4} fontSize="4" fill="#16A34A" fontWeight="bold">You</text>

              {/* Truck */}
              <g transform={`translate(${truckPos.x - 3}, ${truckPos.y - 3})`}>
                <circle r="4" cx="3" cy="3" fill="#F97316" stroke="white" strokeWidth="1" />
                <text x="0.5" y="5" fontSize="4.5">🛵</text>
              </g>
            </svg>
          </div>
        </div>

        {/* Progress steps */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="space-y-3">
            {STAGES.map((s, i) => {
              const isComplete = i < stageIndex;
              const isCurrent = i === stageIndex;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm transition-all ${
                    isComplete ? 'bg-green-500' : isCurrent ? 'bg-orange-500' : 'bg-gray-100'
                  }`}>
                    {isComplete ? <CheckCircle className="h-4 w-4 text-white" /> : (
                      <span className={isCurrent ? 'text-white' : 'text-gray-400'}>{s.emoji}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isComplete ? 'text-green-700' : isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                      {s.label}
                    </p>
                    {isCurrent && <p className="text-xs text-gray-400">{s.sub}</p>}
                  </div>
                  {isCurrent && !delivered && (
                    <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Driver card */}
        {!delivered && stageIndex >= 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
              🧑‍🦱
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">Marcus J.</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span>4.97 · 1,243 deliveries</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="h-9 w-9 rounded-xl flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors">
                <Phone className="h-4 w-4 text-gray-600" />
              </button>
              <button className="h-9 w-9 rounded-xl flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors">
                <MessageSquare className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}

        {/* Rating (post-delivery) */}
        {delivered && !rated && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm text-center">
            <p className="font-bold text-gray-900 mb-1">How was your order?</p>
            <p className="text-sm text-gray-400 mb-4">Rate your experience</p>
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)}
                  className={`text-3xl transition-transform hover:scale-110 ${s <= rating ? '' : 'opacity-30'}`}>
                  ⭐
                </button>
              ))}
            </div>
            {rating > 0 && (
              <button
                onClick={() => setRated(true)}
                className="rounded-xl px-6 py-2.5 text-sm font-bold text-white"
                style={{ background: '#F97316' }}
              >
                Submit Rating
              </button>
            )}
          </div>
        )}

        {rated && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="font-bold text-green-800">Thanks for the {rating}⭐ rating!</p>
            <p className="text-sm text-green-600">Marcus appreciates it 🙏</p>
          </div>
        )}

        {/* Order again */}
        {delivered && (
          <Link href="/delivery/restaurants"
            className="block w-full rounded-2xl py-4 text-base font-bold text-white text-center"
            style={{ background: '#F97316' }}>
            Order Again →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>}>
      <TrackingContent />
    </Suspense>
  );
}
