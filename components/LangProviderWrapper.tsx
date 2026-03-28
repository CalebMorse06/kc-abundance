'use client';

import React from 'react';
import { LangProvider } from '@/contexts/LangContext';

export function LangProviderWrapper({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}
