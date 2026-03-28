'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Star, Clock, Plus, Minus, ShoppingBag, Zap } from 'lucide-react';
import { RESTAURANTS, MENUS, type CartItem } from '@/lib/delivery/mock-data';

export default function RestaurantMenuPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const restaurant = RESTAURANTS.find((r) => r.id === id);
  const menu = MENUS[id] ?? [];
  const categories = [...new Set(menu.map((m) => m.category))];

  const [cart, setCart] = useState<CartItem[]>([]);
  const [surgeActive, setSurgeActive] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? '');

  useEffect(() => {
    const stored = localStorage.getItem('sd_cart');
    if (stored) setCart(JSON.parse(stored));
    const surge = localStorage.getItem('sd_surge');
    if (surge) setSurgeActive(surge === 'true');
  }, []);

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('sd_cart', JSON.stringify(newCart));
  };

  const addItem = (item: typeof menu[0]) => {
    if (!restaurant) return;
    const existing = cart.find((c) => c.item.id === item.id && c.restaurantId === id);
    if (existing) {
      saveCart(cart.map((c) => c.item.id === item.id && c.restaurantId === id
        ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      saveCart([...cart, { item, quantity: 1, restaurantId: id, restaurantName: restaurant.name }]);
    }
  };

  const removeItem = (itemId: string) => {
    const existing = cart.find((c) => c.item.id === itemId && c.restaurantId === id);
    if (!existing) return;
    if (existing.quantity === 1) {
      saveCart(cart.filter((c) => !(c.item.id === itemId && c.restaurantId === id)));
    } else {
      saveCart(cart.map((c) => c.item.id === itemId && c.restaurantId === id
        ? { ...c, quantity: c.quantity - 1 } : c));
    }
  };

  const getQty = (itemId: string) =>
    cart.find((c) => c.item.id === itemId && c.restaurantId === id)?.quantity ?? 0;

  const cartTotal = cart
    .filter((c) => c.restaurantId === id)
    .reduce((sum, c) => sum + c.item.price * c.quantity, 0);

  const cartCount = cart
    .filter((c) => c.restaurantId === id)
    .reduce((sum, c) => sum + c.quantity, 0);

  const deliveryFee = restaurant
    ? surgeActive ? restaurant.deliveryFee * 1.5 : restaurant.deliveryFee
    : 0;

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Restaurant not found.</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#FAFAFA', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#0F172A' }} className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/delivery/restaurants" className="text-white/70 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <p className="font-bold text-white">{restaurant.name}</p>
            <p className="text-xs text-white/50">{restaurant.category}</p>
          </div>
          {cartCount > 0 && (
            <button
              onClick={() => router.push('/delivery/checkout')}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: '#F97316' }}
            >
              <ShoppingBag className="h-4 w-4" />
              {cartCount} · ${cartTotal.toFixed(2)}
            </button>
          )}
        </div>
      </div>

      {/* Restaurant hero */}
      <div className="h-40 flex items-center justify-center text-7xl"
        style={{ background: 'linear-gradient(135deg, #1E293B, #334155)' }}>
        {restaurant.emoji}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 shadow-sm">
          <h1 className="text-2xl font-black text-gray-900 mb-1">{restaurant.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <strong className="text-gray-700">{restaurant.rating}</strong> ({restaurant.reviews})
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {restaurant.deliveryTime} min
            </span>
            <span className={`font-semibold ${surgeActive ? 'text-red-600' : 'text-gray-700'}`}>
              {surgeActive
                ? <><s className="text-gray-400 font-normal mr-1">${restaurant.deliveryFee.toFixed(2)}</s>${deliveryFee.toFixed(2)} delivery <span className="text-xs bg-red-100 px-1 rounded">Surge 1.5×</span></>
                : `$${deliveryFee.toFixed(2)} delivery`
              }
            </span>
          </div>
          {surgeActive && (
            <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-100">
              <Zap className="h-3.5 w-3.5" />
              Surge pricing active — high demand in your area
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-3">
            {restaurant.tags.map((t) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{t}</span>
            ))}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === c ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
              style={activeCategory === c ? { background: '#0F172A' } : {}}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="space-y-3 pb-32">
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="text-lg font-black text-gray-900 mb-3">{cat}</h2>
              <div className="space-y-3">
                {menu.filter((m) => m.category === cat).map((item) => {
                  const qty = getQty(item.id);
                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 shadow-sm">
                      <div className="h-16 w-16 flex-shrink-0 rounded-xl flex items-center justify-center text-3xl"
                        style={{ background: '#F1F5F9' }}>
                        {item.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                          {item.popular && (
                            <span className="text-xs font-bold px-1.5 rounded-full text-white" style={{ background: '#F97316' }}>Popular</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                        <p className="text-sm font-bold text-gray-900 mt-1">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex-shrink-0">
                        {qty === 0 ? (
                          <button
                            onClick={() => addItem(item)}
                            className="h-9 w-9 rounded-full flex items-center justify-center text-white transition-transform hover:scale-110"
                            style={{ background: '#F97316' }}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button onClick={() => removeItem(item.id)}
                              className="h-8 w-8 rounded-full flex items-center justify-center border-2 border-gray-200 text-gray-600 hover:border-gray-400">
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-sm font-bold text-gray-900 w-4 text-center">{qty}</span>
                            <button onClick={() => addItem(item)}
                              className="h-8 w-8 rounded-full flex items-center justify-center text-white"
                              style={{ background: '#F97316' }}>
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky cart CTA */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderTop: '1px solid #E5E7EB' }}>
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => router.push('/delivery/checkout')}
              className="w-full rounded-2xl py-4 text-base font-bold text-white flex items-center justify-between px-5 transition-transform hover:scale-[1.01]"
              style={{ background: '#F97316' }}
            >
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm">{cartCount}</span>
              <span>View Cart</span>
              <span>${cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
