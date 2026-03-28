import React from 'react';
import Link from 'next/link';
import { Clock, MapPin, Bus, Snowflake, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NeedScoreBadge } from '@/components/NeedScoreBadge';
import { cn } from '@/lib/utils';
import type { Site, NeighborhoodScore, ParsedHours } from '@/types';

interface SiteCardProps {
  site: Site;
  neighborhoodScore?: NeighborhoodScore | null;
  transitAccessible?: boolean;
  className?: string;
  compact?: boolean;
}

function isOpenNow(hoursParsed: ParsedHours[] | null): boolean {
  if (!hoursParsed || hoursParsed.length === 0) return false;

  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  );
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayName = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return hoursParsed.some((h) => {
    if (h.day.toLowerCase() !== todayName) return false;
    return currentTime >= h.open && currentTime <= h.close;
  });
}

function formatHoursShort(hoursParsed: ParsedHours[] | null, raw: string): string {
  if (!hoursParsed || hoursParsed.length === 0) return raw || 'Hours vary';

  // Group days by open/close times
  const timeGroups = new Map<string, string[]>();
  for (const h of hoursParsed) {
    const key = `${h.open}–${h.close}`;
    if (!timeGroups.has(key)) timeGroups.set(key, []);
    timeGroups.get(key)!.push(h.day.slice(0, 3));
  }

  const parts: string[] = [];
  timeGroups.forEach((days, time) => {
    const dayStr = days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join('/');
    // Convert 24h to 12h
    const [openH, openM] = time.split('–')[0].split(':');
    const [closeH, closeM] = time.split('–')[1].split(':');
    const fmt = (h: string, m: string) => {
      const hour = parseInt(h, 10);
      const suffix = hour >= 12 ? 'pm' : 'am';
      const h12 = hour % 12 || 12;
      return `${h12}${m !== '00' ? ':' + m : ''}${suffix}`;
    };
    parts.push(`${dayStr} ${fmt(openH, openM)}–${fmt(closeH, closeM)}`);
  });
  return parts.slice(0, 2).join('; ');
}

const siteTypeLabels: Record<string, string> = {
  pantry: 'Food Pantry',
  mobile: 'Mobile Pantry',
  popup: 'Popup Event',
  distribution_center: 'Distribution Center',
  partner: 'Partner Site',
};

const siteTypeVariants: Record<string, 'default' | 'info' | 'warning' | 'secondary'> = {
  pantry: 'default',
  mobile: 'info',
  popup: 'warning',
  distribution_center: 'info',
  partner: 'secondary',
};

export function SiteCard({ site, neighborhoodScore, transitAccessible, className, compact }: SiteCardProps) {
  const openNow = isOpenNow(site.hours_parsed);
  const hoursDisplay = formatHoursShort(site.hours_parsed, site.hours_raw ?? '');
  const hasSpanish = site.languages.includes('es');
  const hasCold = site.cold_storage_type !== 'none';

  return (
    <Link href={`/site/${site.id}`} className="block group">
      <div
        className={cn(
          'rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-[#2D8C7A]/40 group-hover:-translate-y-0.5',
          compact ? 'p-3' : 'p-4',
          className
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge variant={siteTypeVariants[site.type] || 'secondary'}>
                {siteTypeLabels[site.type] || site.type}
              </Badge>
              {openNow && (
                <Badge variant="default" className="border-0" style={{ background: 'var(--brand-teal)', color: 'white' }}>
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Open Now
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 leading-tight truncate group-hover:text-[#1B3A52] transition-colors">
              {site.name}
            </h3>
            {!compact && (
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{site.address}</span>
                <span className="text-gray-400">·</span>
                <span className="font-medium">{site.zip}</span>
              </div>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0 group-hover:text-[#2D8C7A] transition-colors mt-0.5" />
        </div>

        {/* Hours */}
        {!compact && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{hoursDisplay}</span>
          </div>
        )}

        {/* Attribute badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {site.languages.map((lang) => (
            <Badge key={lang} variant="outline" className="text-xs">
              {lang.toUpperCase()}
            </Badge>
          ))}
          {hasCold && (
            <Badge variant="info" className="text-xs flex items-center gap-1">
              <Snowflake className="h-3 w-3" />
              Fresh Produce
            </Badge>
          )}
          {!site.id_required && (
            <Badge variant="secondary" className="text-xs">
              No ID Required
            </Badge>
          )}
          {transitAccessible && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <Bus className="h-3 w-3" />
              Bus Access
            </Badge>
          )}
        </div>

        {/* Need score */}
        {neighborhoodScore && !compact && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">Community Need — ZIP {site.zip ?? ''}</div>
            <NeedScoreBadge score={neighborhoodScore.need_score ?? 0} size="sm" />
          </div>
        )}
      </div>
    </Link>
  );
}
