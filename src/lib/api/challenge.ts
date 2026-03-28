import { createClient } from '@/lib/supabase/server';
import type {
  ChallengeApiWrapper,
  ChallengePantry,
  ChallengeFoodAtlasTract,
  ChallengeStoreClosure,
  ChallengeTransitStop,
  ChallengeDemographics,
  ChallengeDistressCall,
  ChallengeSupplyAlertsResponse,
  ChallengeHarvestZip,
} from '@/types';

const BASE = process.env.CHALLENGE_API_BASE ?? 'https://aipromptchamp.com/api';

// TTL in seconds for each cache key
const TTL: Record<string, number> = {
  '311-calls': 3600,
  pantries: 1800,
  'food-atlas': 86400,
  'store-closures': 3600,
  transit: 900,
  demographics: 86400,
  'supply-alerts': 60,
  harvest: 3600,
};

export function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

async function fetchWithCache<T>(
  cacheKey: string,
  url: string,
  ttlSeconds?: number
): Promise<T> {
  const supabase = await createClient();
  const ttl = ttlSeconds ?? TTL[cacheKey.split('?')[0]] ?? 3600;

  // Check cache
  const { data: cached } = await supabase
    .from('api_cache')
    .select('data, expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (cached?.data && cached.expires_at && new Date(cached.expires_at) > new Date()) {
    return cached.data as T;
  }

  // Fetch from API
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Challenge API ${url} returned ${res.status}`);
  const raw = await res.text();
  const data = JSON.parse(raw) as T;
  const apiHash = hashString(raw);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  await supabase.from('api_cache').upsert(
    { cache_key: cacheKey, data, api_hash: apiHash, expires_at: expiresAt },
    { onConflict: 'cache_key' }
  );

  return data;
}

// Fetch ALL pantries (no zip filter returns all 12)
export async function fetchAllPantries(): Promise<ChallengePantry[]> {
  const wrapper = await fetchWithCache<ChallengeApiWrapper<ChallengePantry>>(
    'pantries',
    `${BASE}/challenge/pantries`
  );
  return wrapper?.data ?? [];
}

export async function fetchFoodAtlas(): Promise<ChallengeFoodAtlasTract[]> {
  const wrapper = await fetchWithCache<ChallengeApiWrapper<ChallengeFoodAtlasTract>>(
    'food-atlas',
    `${BASE}/challenge/food-atlas`
  );
  return wrapper?.data ?? [];
}

export async function fetchStoreClosures(): Promise<ChallengeStoreClosure[]> {
  const wrapper = await fetchWithCache<{ source: string; count: number; data: ChallengeStoreClosure[] }>(
    'store-closures',
    `${BASE}/challenge/store-closures`
  );
  return wrapper?.data ?? [];
}

export async function fetchTransit(lat: number, lng: number): Promise<ChallengeTransitStop[]> {
  const wrapper = await fetchWithCache<ChallengeApiWrapper<ChallengeTransitStop>>(
    `transit?near=${lat},${lng}`,
    `${BASE}/challenge/transit?near=${lat},${lng}`,
    TTL.transit
  );
  return wrapper?.data ?? [];
}

export async function fetchAllDemographics(): Promise<ChallengeDemographics[]> {
  const wrapper = await fetchWithCache<ChallengeApiWrapper<ChallengeDemographics>>(
    'demographics',
    `${BASE}/challenge/demographics`
  );
  return wrapper?.data ?? [];
}

export async function fetchDemographicsForZip(zip: string): Promise<ChallengeDemographics | null> {
  const all = await fetchAllDemographics();
  return all.find((d) => d.zip === zip) ?? null;
}

export async function fetchAllDistressCalls(): Promise<ChallengeDistressCall[]> {
  const wrapper = await fetchWithCache<{ source: string; period: string; data: ChallengeDistressCall[] }>(
    '311-calls',
    `${BASE}/challenge/311-calls`
  );
  return wrapper?.data ?? [];
}

export async function fetchDistressCallsForZip(zip: string): Promise<ChallengeDistressCall | null> {
  const all = await fetchAllDistressCalls();
  return all.find((d) => d.zip === zip) ?? null;
}

// Supply alerts — always fetches live, very short TTL
export async function fetchSupplyAlerts(): Promise<ChallengeSupplyAlertsResponse> {
  const supabase = await createClient();
  const cacheKey = 'supply-alerts';
  const url = `${BASE}/challenge/supply-alerts`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Supply alerts API returned ${res.status}`);
  const raw = await res.text();
  const data = JSON.parse(raw) as ChallengeSupplyAlertsResponse;
  const apiHash = hashString(raw);
  const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

  await supabase.from('api_cache').upsert(
    { cache_key: cacheKey, data, api_hash: apiHash, expires_at: expiresAt },
    { onConflict: 'cache_key' }
  );

  return data;
}

export async function fetchHarvest(): Promise<ChallengeHarvestZip[]> {
  const wrapper = await fetchWithCache<ChallengeApiWrapper<ChallengeHarvestZip>>(
    'harvest',
    `${BASE}/challenge/harvest`
  );
  return wrapper?.data ?? [];
}

export { hashString as default };
