'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2, HelpCircle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import type { HelpBarrier, Language } from '@/types';

const barriers: { id: HelpBarrier; en: string; es: string }[] = [
  { id: 'no_car', en: 'No car / transportation', es: 'Sin carro / transporte' },
  { id: 'language_barrier', en: 'Language barrier', es: 'Barrera de idioma' },
  { id: 'disability', en: 'Disability', es: 'Discapacidad' },
  { id: 'senior', en: 'Senior citizen (65+)', es: 'Adulto mayor (65+)' },
  { id: 'infant', en: 'Infant / young children', es: 'Bebé / niños pequeños' },
];

function RequestHelpForm() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site_id');

  const { lang, setLang } = useLanguage();
  const [zip, setZip] = useState('');
  const [selectedBarriers, setSelectedBarriers] = useState<HelpBarrier[]>([]);
  const [contactInfo, setContactInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const toggleBarrier = (b: HelpBarrier) => {
    setSelectedBarriers((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zip || selectedBarriers.length === 0) {
      setError(lang === 'en' ? 'Please fill in all required fields' : 'Por favor complete todos los campos requeridos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/help-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip,
          barrier_type: selectedBarriers,
          preferred_language: lang,
          contact_info: contactInfo || undefined,
          notes: notes || undefined,
          site_id: siteId || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Request Received!</h2>
          <p className="mt-2 text-gray-600">
            Your request has been received. We will connect you with food resources soon.
          </p>
          <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-green-800 text-sm italic">
              Tu solicitud ha sido recibida. Te conectaremos con recursos de alimentos pronto.
            </p>
          </div>
          <a href="/map" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
            Find food near me →
          </a>
        </div>
      </div>
    );
  }

  const isEs = lang === 'es';

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 mb-4">
          <HelpCircle className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {isEs ? 'Solicitar Asistencia de Alimentos' : 'Request Food Assistance'}
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          {isEs
            ? 'Podemos ayudarte a conectar con recursos de alimentos en Kansas City'
            : 'We can help connect you with food resources in Kansas City'}
        </p>
        {siteId && (
          <p className="mt-2 text-xs text-green-600 font-medium">
            Requesting help for a specific site
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Language preference */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            {isEs ? 'Idioma preferido' : 'Preferred Language'}
          </label>
          <div className="flex gap-3">
            {(['en', 'es'] as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                  lang === l
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-green-300'
                }`}
              >
                {l === 'en' ? '🇺🇸 English' : '🇲🇽 Español'}
              </button>
            ))}
          </div>
        </div>

        {/* ZIP code */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            {isEs ? 'Tu código postal *' : 'Your ZIP Code *'}
          </label>
          <p className="text-xs text-gray-500 mb-3">
            {isEs ? 'Código postal de 5 dígitos' : '5-digit ZIP code'}
          </p>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g. 64105"
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-lg font-medium tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal"
            required
            maxLength={5}
            pattern="[0-9]{5}"
          />
        </div>

        {/* Barriers */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            {isEs ? '¿Qué barreras enfrentas? *' : 'What barriers do you face? *'}
          </label>
          <p className="text-xs text-gray-500 mb-4">
            {isEs ? 'Selecciona todo lo que aplique' : 'Select all that apply'}
          </p>
          <div className="space-y-2">
            {barriers.map((b) => {
              const selected = selectedBarriers.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBarrier(b.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    selected
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-200 text-gray-700 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    selected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {selected && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="text-sm">{isEs ? b.es : b.en}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact info */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            {isEs ? 'Información de contacto (opcional)' : 'Contact Info (optional)'}
          </label>
          <p className="text-xs text-gray-500 mb-3">
            {isEs
              ? 'Teléfono o correo para dar seguimiento'
              : 'Phone or email so we can follow up with you'}
          </p>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder={isEs ? 'Teléfono o correo electrónico' : 'Phone or email'}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300"
          />
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            {isEs ? 'Notas adicionales (opcional)' : 'Additional Notes (optional)'}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={isEs ? 'Cualquier información adicional...' : 'Any other information that would help us assist you...'}
            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300 resize-none"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || zip.length !== 5 || selectedBarriers.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-base font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {isEs ? 'Enviar Solicitud' : 'Submit Request'}
        </button>

        <p className="text-center text-xs text-gray-400">
          Your information is kept confidential and anonymous unless you provide contact info.
        </p>
      </form>
    </div>
  );
}

export default function RequestHelpPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-green-600" /></div>}>
      <RequestHelpForm />
    </Suspense>
  );
}
