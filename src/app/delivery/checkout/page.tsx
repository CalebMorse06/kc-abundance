'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Clock, Zap, CreditCard, ChevronRight, AlertTriangle } from 'lucide-react';
import type { CartItem } from '@/lib/delivery/mock-data';

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<{ name: string; address: string } | null>(null);
  const [surgeActive, setSurgeActive] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [tip, setTip] = useState(15); // percent

  useEffect(() => {
    const c = localStorage.getItem('sd_cart');
    const u = localStorage.getItem('sd_user');
    if (c) setCart(JSON.parse(c));
    if (u) setUser(JSON.parse(u));
  }, []);

  const toggleSurge = () => {
    const next = !surgeActive;
    setSurgeActive(next);
    localStorage.setItem('sd_surge', String(next));
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#FAFAFA' }}>
        <p className="text-5xl mb-4">🛒</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <Link href="/delivery/restaurants"
          className="mt-4 rounded-xl px-6 py-3 text-sm font-bold text-white"
          style={{ background: '#F97316' }}>
          Browse Restaurants →
        </Link>
      </div>
    );
  }

  // Group by restaurant
  const byRestaurant = cart.reduce<Record<string, CartItem[]>>((acc, item) => {
    if (!acc[item.restaurantId]) acc[item.restaurantId] = [];
    acc[item.restaurantId].push(item);
    return acc;
  }, {});

  const restaurantId = Object.keys(byRestaurant)[0];
  const restaurantName = cart[0]?.restaurantName ?? '';
  const items = byRestaurant[restaurantId] ?? [];

  const subtotal = items.reduce((s, c) => s + c.item.price * c.quantity, 0);
  const baseDeliveryFee = 2.99;
  const deliveryFee = surgeActive ? baseDeliveryFee * 1.5 : baseDeliveryFee;
  const surgeFeeExtra = surgeActive ? deliveryFee - baseDeliveryFee : 0;
  const serviceFee = 0; // transparent pricing — no service fee
  const tipAmount = subtotal * (tip / 100);
  const total = subtotal + deliveryFee + serviceFee + tipAmount;

  const handlePlaceOrder = async () => {
    setPlacing(true);
    await new Promise((r) => setTimeout(r, 1800));
    localStorage.removeItem('sd_cart');
    const orderId = `SD-${Date.now().toString(36).toUpperCase()}`;
    localStorage.setItem('sd_order', JSON.stringify({
      id: orderId,
      restaurantName,
      items,
      total,
      address: user?.address,
      placedAt: new Date().toISOString(),
      surgeActive,
    }));
    router.push(`/delivery/tracking?order=${orderId}`);
  };

  return (
    <div style={{ background: '#FAFAFA', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#0F172A' }} className="sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/delivery/restaurant/${restaurantId}`} className="text-white/70 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-bold text-white flex-1">Checkout</h1>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4 pb-36">

        {/* Surge pricing control — THE feature */}
        <div className={`rounded-2xl border-2 p-4 transition-all ${surgeActive ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 ${surgeActive ? 'bg-red-100' : 'bg-gray-100'}`}>
                <Zap className={`h-4 w-4 ${surgeActive ? 'text-red-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-sm font-bold ${surgeActive ? 'text-red-800' : 'text-gray-700'}`}>
                  {surgeActive ? 'Surge Pricing Active' : 'Normal Pricing'}
                </p>
                <p className="text-xs text-gray-500">
                  {surgeActive ? 'High demand · Delivery fee +50%' : 'Low demand · Standard rates'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleSurge}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${surgeActive ? 'bg-red-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${surgeActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {surgeActive && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Surge pricing is in effect due to high demand. Delivery fee increased from ${baseDeliveryFee.toFixed(2)} to ${deliveryFee.toFixed(2)}. You can wait for demand to drop or proceed now.</span>
            </div>
          )}
        </div>

        {/* Delivery address */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: '#F97316' }}>
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Delivering to</p>
                <p className="text-sm font-semibold text-gray-900">{user?.address ?? 'Set address'}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Est. delivery */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-blue-50">
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Estimated delivery</p>
            <p className="text-sm font-semibold text-gray-900">
              {surgeActive ? '30–45 min' : '20–30 min'} · {restaurantName}
            </p>
          </div>
        </div>

        {/* Order items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="font-bold text-gray-900 text-sm">Your Order</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map((c) => (
              <div key={c.item.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{c.quantity}×</span>
                  <span className="text-sm text-gray-800">{c.item.emoji} {c.item.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">${(c.item.price * c.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tip selector */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-3">Tip your driver</p>
          <div className="grid grid-cols-4 gap-2">
            {[10, 15, 20, 25].map((t) => (
              <button
                key={t}
                onClick={() => setTip(t)}
                className={`rounded-xl py-2 text-sm font-bold transition-colors ${tip === t ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                style={tip === t ? { background: '#0F172A' } : {}}
              >
                {t}%
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Driver receives 100% of tip</p>
        </div>

        {/* Price breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
          <h2 className="font-bold text-gray-900 text-sm mb-3">Order Summary</h2>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Delivery fee</span>
            <span className={surgeActive ? 'text-red-600 font-semibold' : ''}>
              {surgeActive && <s className="text-gray-400 mr-1">${baseDeliveryFee.toFixed(2)}</s>}
              ${deliveryFee.toFixed(2)}
              {surgeActive && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1 rounded">+50%</span>}
            </span>
          </div>
          {surgeActive && (
            <div className="flex justify-between text-xs text-red-600">
              <span>Surge fee</span>
              <span>+${surgeFeeExtra.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Service fee</span>
            <span className="text-green-600 font-medium">$0.00 ✓</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tip ({tip}%)</span>
            <span>${tipAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Total</span>
            <span className={surgeActive ? 'text-red-700' : ''}>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">•••• •••• •••• 4242</p>
            <p className="text-xs text-gray-400">Visa · Demo card</p>
          </div>
          <span className="text-xs text-green-600 font-semibold">Ready</span>
        </div>
      </div>

      {/* Place order CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-50"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderTop: '1px solid #E5E7EB' }}>
        <div className="max-w-xl mx-auto">
          <button
            onClick={handlePlaceOrder}
            disabled={placing}
            className="w-full rounded-2xl py-4 text-base font-bold text-white flex items-center justify-between px-5 transition-all disabled:opacity-70"
            style={{ background: surgeActive ? '#DC2626' : '#F97316' }}
          >
            <span>{placing ? '⏳ Placing order…' : 'Place Order'}</span>
            <span className={`font-black ${surgeActive ? 'text-red-200' : 'text-orange-200'}`}>
              ${total.toFixed(2)}{surgeActive ? ' ⚡' : ''}
            </span>
          </button>
          {surgeActive && (
            <p className="text-center text-xs text-red-600 mt-2 font-medium">
              ⚡ Surge pricing applied — ${surgeFeeExtra.toFixed(2)} extra on delivery fee
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
