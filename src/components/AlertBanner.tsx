'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { SpoilageTimerCompact } from './SpoilageTimer';
import type { SupplyAlert } from '@/types';

interface AlertBannerProps {
  alert: SupplyAlert;
}

export function AlertBanner({ alert }: AlertBannerProps) {
  const spoilageDeadline = alert.perishability_hours
    ? new Date(new Date(alert.created_at).getTime() + alert.perishability_hours * 60 * 60 * 1000).toISOString()
    : null;

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-red-500 bg-red-600 text-white shadow-lg animate-in slide-in-from-top-2">
      {/* Pulsing border overlay */}
      <div className="absolute inset-0 rounded-xl border-2 border-red-400 animate-ping opacity-30 pointer-events-none" />

      <div className="relative p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 rounded-full bg-white/20 p-1.5">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
                  URGENT
                </span>
                <span className="text-xs text-red-100">Produce Rescue Needed</span>
              </div>
              <h3 className="mt-1 text-base font-bold leading-tight sm:text-lg">
                {alert.title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-red-100">
                <span>{(alert.quantity_lbs ?? 0).toLocaleString()} lbs available</span>
                {spoilageDeadline && (
                  <span className="flex items-center gap-1">
                    <span className="opacity-75">Spoils in:</span>
                    <SpoilageTimerCompact deadline={spoilageDeadline} />
                  </span>
                )}
              </div>
            </div>
          </div>

          <Link
            href={`/dashboard/supply/${alert.id}`}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 flex-shrink-0"
          >
            View Allocation Recommendations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
