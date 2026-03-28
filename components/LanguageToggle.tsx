'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className }: LanguageToggleProps) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5',
        className
      )}
      role="group"
      aria-label="Language selection"
    >
      <button
        onClick={() => setLang('en')}
        className={cn(
          'rounded-full px-3 py-1 text-sm font-medium transition-all',
          lang === 'en'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        )}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
      <button
        onClick={() => setLang('es')}
        className={cn(
          'rounded-full px-3 py-1 text-sm font-medium transition-all',
          lang === 'es'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        )}
        aria-pressed={lang === 'es'}
      >
        ES
      </button>
    </div>
  );
}
