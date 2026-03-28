'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Lang } from '@/lib/i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const cookie = document.cookie.split(';').find((c) => c.trim().startsWith('lang='));
    const stored = cookie?.split('=')?.[1]?.trim();
    if (stored === 'en' || stored === 'es') setLangState(stored as Lang);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `lang=${l};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
