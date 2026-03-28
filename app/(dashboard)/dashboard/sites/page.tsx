'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Snowflake, Globe, Filter, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NeedScoreBadge } from '@/components/NeedScoreBadge';
import { Badge } from '@/components/ui/badge';
import type { Site, NeighborhoodScore } from '@/types';

type SiteWithScore = Site & { need_score?: number | null };

const coldLabels: Record<string, string> = {
  none: 'None',
  refrigerated: 'Fridge',
  industrial: 'Industrial',
};

export default function SitesPage() {
  const [sites, setSites] = useState<SiteWithScore[]>([]);
  const [scores, setScores] = useState<Map<string, NeighborhoodScore>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterZip, setFilterZip] = useState('');
  const [filterCold, setFilterCold] = useState('all');
  const [filterLang, setFilterLang] = useState('all');

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: sitesData }, { data: scoresData }] = await Promise.all([
        supabase.from('sites').select('*').order('name'),
        supabase.from('neighborhood_scores').select('*'),
      ]);
      setSites((sitesData ?? []) as SiteWithScore[]);
      const m = new Map<string, NeighborhoodScore>();
      for (const s of scoresData ?? []) m.set(s.zip, s as NeighborhoodScore);
      setScores(m);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return sites.filter((site) => {
      if (search && !site.name.toLowerCase().includes(search.toLowerCase()) && !(site.zip ?? '').includes(search)) return false;
      if (filterType !== 'all' && site.type !== filterType) return false;
      if (filterZip && !(site.zip ?? '').includes(filterZip)) return false;
      if (filterCold !== 'all' && site.cold_storage_type !== filterCold) return false;
      if (filterLang !== 'all' && !site.languages.includes(filterLang as 'en' | 'es')) return false;
      return true;
    });
  }, [sites, search, filterType, filterZip, filterCold, filterLang]);

  const uniqueTypes = [...new Set(sites.map((s) => s.type))];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Site Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">All food sites — pantries, mobile, popups</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or ZIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Types</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Cold storage filter */}
        <select
          value={filterCold}
          onChange={(e) => setFilterCold(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Cold Storage</option>
          <option value="none">None</option>
          <option value="refrigerated">Refrigerated</option>
          <option value="industrial">Industrial</option>
        </select>

        {/* Language filter */}
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Languages</option>
          <option value="en">English</option>
          <option value="es">Spanish / Español</option>
        </select>

        <div className="flex items-center gap-1.5 text-sm text-gray-500 ml-auto">
          <Filter className="h-4 w-4" />
          <span>{filtered.length} of {sites.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ZIP</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Languages</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cold Storage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID Req.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Need Score</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">
                      No sites match your filters
                    </td>
                  </tr>
                )}
                {filtered.map((site, i) => {
                  const ns = scores.get(site.zip ?? '');
                  return (
                    <tr key={site.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3">
                        <Link href={`/site/${site.id}`} className="font-medium text-gray-900 hover:text-green-700 transition-colors truncate max-w-48 block">
                          {site.name}
                        </Link>
                        {site.address && <p className="text-xs text-gray-400 truncate max-w-48">{site.address}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{site.zip ?? ''}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {site.type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 max-w-32 block truncate" title={site.hours_raw ?? undefined}>
                          {site.hours_raw || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {site.languages.map((l) => (
                            <Badge key={l} variant="outline" className="text-xs">
                              {l.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {site.cold_storage_type === 'none' ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <Snowflake className="h-3 w-3" />
                            {coldLabels[site.cold_storage_type]}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {site.id_required ? (
                          <span className="text-amber-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-green-600">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={site.active ? 'default' : 'secondary'} className="text-xs">
                          {site.active ? 'active' : 'inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 w-32">
                        {ns ? (
                          <NeedScoreBadge score={ns.need_score ?? 0} showLabel={false} size="sm" />
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/site/${site.id}`}
                          className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sites', value: sites.length },
          { label: 'Active', value: sites.filter((s) => s.active).length },
          { label: 'Spanish Serving', value: sites.filter((s) => s.languages.includes('es')).length },
          { label: 'Cold Storage', value: sites.filter((s) => s.cold_storage_type !== 'none').length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
