# Abundance-KC — Technical Walkthrough

> A food access coordination platform for Kansas City. Bridges food distribution networks with residents through an operator dashboard and a public-facing resident portal.

---

## 1. Stack at a Glance

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI / Styling | Tailwind CSS 4 + Radix UI + shadcn-style components |
| Backend / DB | Supabase (Postgres + Auth + Realtime) |
| Maps | Mapbox GL via react-map-gl |
| AI | Anthropic Claude (claude-haiku-4-5) via direct API |
| Email | Resend |
| External Data | Challenge API (pantries, demographics, supply alerts) |
| Fonts | Plus Jakarta Sans (headings) + Inter (body) |

---

## 2. Repository Layout

```
src/
├── app/
│   ├── (public)/          # Unauthenticated resident-facing pages
│   │   ├── page.tsx           — Landing page
│   │   ├── map/               — Interactive site finder map
│   │   ├── request-help/      — Resident help request form
│   │   ├── community/[zip]/   — Community voting by ZIP
│   │   └── site/[id]/         — Individual site detail
│   ├── (dashboard)/       # Operator dashboard (auth-gated)
│   │   ├── dashboard/         — Command center
│   │   ├── dashboard/sites    — Site inventory management
│   │   ├── dashboard/supply   — Supply alerts & batch allocation
│   │   └── dashboard/analytics
│   ├── delivery/          # Restaurant / delivery partner section (PoC)
│   ├── api/               # All API route handlers
│   └── globals.css        # Design tokens (CSS variables)
├── components/            # React components
│   └── ui/                — Shadcn-style primitives (Badge, Button, Card…)
├── contexts/
│   └── LangContext.tsx    # EN/ES language state (React Context + cookie)
├── lib/
│   ├── supabase/          — Browser + server Supabase clients
│   ├── api/challenge.ts   — Challenge API client with TTL cache
│   ├── scoring/           — Need score + allocation algorithm
│   ├── i18n.ts            — Translation string dictionary
│   ├── ai.ts              — Claude integration helpers
│   ├── escalation.ts      — Perishable batch escalation logic
│   └── ingest.ts          — Data ingestion pipeline
└── types/index.ts         # All shared TypeScript interfaces
```

---

## 3. Data Model

All types live in `src/types/index.ts`. The core entities are:

### Sites
```ts
interface Site {
  id: string;
  name: string;
  address: string;
  zip: string;
  lat: number;
  lng: number;
  type: 'food_bank' | 'pantry' | 'mobile' | 'shelter' | 'school' | 'garden' | 'popup';
  hours_parsed: Record<string, string>;
  languages: string[];
  cold_storage_type: 'none' | 'refrigeration' | 'freezer';
  capacity_lbs: number;
}
```

### Supply Chain
```ts
interface SupplyAlert {
  id: string;
  title: string;
  quantity_lbs: number;
  perishability_hours: number;
  requires_cold: boolean;
  status: 'new' | 'processing' | 'allocated' | 'closed';
  impacted_zips: string[];
}

interface FoodBatch {
  status: 'unallocated' | 'partially_allocated' | 'allocated' | 'delivered' | 'spoiled';
  // …links to alert, site allocations
}

interface Allocation {
  batch_id: string;
  site_id: string;
  quantity_lbs: number;
  site_score: number;       // 0–100
  rationale: AllocationRationale;
}
```

### Scoring
```ts
interface NeighborhoodScore {
  zip: string;
  poverty_rate: number;
  food_insecurity_pct: number;
  no_car_pct: number;
  hispanic_pct: number;
  need_score: number;        // computed 0–100
  food_desert: boolean;
  harvest_priority: boolean;
}
```

### People
```ts
interface HelpRequest {
  zip: string;
  barriers: ('no_car' | 'language' | 'disability' | 'senior' | 'infant')[];
  language: 'en' | 'es';
  // contact fields…
}

interface Profile {
  role: 'ops_admin' | 'dispatcher' | 'pantry_manager' | 'outreach_staff' | 'analyst';
}
```

### Supabase Tables Summary

| Table | Purpose |
|---|---|
| `sites` | Food distribution locations |
| `neighborhood_scores` | Pre-computed need metrics per ZIP |
| `food_batches` | Incoming food to be allocated |
| `allocations` | Site assignments with scores |
| `supply_alerts` | Alert records from Challenge API |
| `popup_events` | Auto-triggered or scheduled pop-ups |
| `help_requests` | Resident submissions |
| `community_votes` + `vote_signals` | Voting with fingerprint fraud prevention |
| `analytics_events` | Event log (distributions, requests, etc.) |
| `api_cache` | TTL cache for Challenge API responses |
| `store_closures`, `food_desert_tracts`, `harvest_priority_zips` | Supplemental geo data |

---

## 4. Key Technical Decisions

### 4.1 Neighborhood Need Score
`src/lib/scoring/need.ts`

A weighted composite of five signals, normalized to 0–100:

```
need_score =
  poverty_rate          × 0.25
  + food_insecurity_pct × 0.25
  + no_car_pct          × 0.20
  + store_closure_impact× 0.15   (people_impacted / 50 000)
  + distress_calls_norm × 0.10   (calls / 500)
  + food_desert_flag    × 0.05

× 1.15 if harvest_priority ZIP   (capped at 100)
```

**Why:** Poverty alone under-counts households that are food-insecure because of mobility, language, or supply-side gaps (closures, distress calls). Harvest priority ZIPs get a bump because fresh produce spoils faster and those neighborhoods have the least access.

---

### 4.2 Batch Allocation Algorithm
`src/lib/scoring/allocation.ts`

When a food batch arrives, every eligible site is scored:

```
site_score =
  neighborhood_need_score × 0.30
  + cold_storage_match    × 0.25  (hard 0 if batch needs cold but site has none)
  + language_match        × 0.20  (1.0 if site serves ZIP's primary language)
  + capacity_available    × 0.15  (normalized remaining lbs)
  + transit_accessible    × 0.10  (bus stop within walking distance)
```

Sites are ranked and presented to operators with a human-readable rationale. Operators confirm; AI (Claude) generates a 1–2-sentence explanation of the top pick.

**Why these weights:** Community need drives the most allocation weight because that is the mission. Cold-storage compatibility is second because wasted perishables are an irreversible failure. Language access follows because a site that cannot communicate with local residents is effectively inaccessible even if geographically close.

---

### 4.3 Escalation Engine
`src/lib/escalation.ts` + `src/app/api/escalate/route.ts`

Batches approaching spoilage are escalated automatically:

```
escalation_threshold = perishability_hours × 0.4
```

If a batch will expire within this window and remains unallocated, the engine:
1. Selects the highest-need ZIP in the batch's impacted zone.
2. Creates a `popup_event` record tied to that alert.
3. Operators are notified via the realtime dashboard.

Manual override is available via `POST /api/escalate?alert_id=…`.

**Why 40 %:** Leaves enough lead time for logistics without triggering false alarms too early. Configurable per deployment.

---

### 4.4 Real-Time Dashboard
`src/app/(dashboard)/dashboard/page.tsx`

Uses Supabase Realtime channel subscriptions instead of polling:

```ts
const channel = supabase
  .channel('supply_alerts_changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'supply_alerts' },
    (payload) => setAlerts(prev => [payload.new as SupplyAlert, ...prev])
  )
  .subscribe();
```

**Why:** Operators need sub-second awareness of new perishable alerts. HTTP polling introduces lag; realtime subscriptions are push-based and free at Supabase's tier.

---

### 4.5 Challenge API Caching
`src/lib/api/challenge.ts`

All external Challenge API calls go through a TTL cache stored in Supabase's `api_cache` table. Response hashes detect whether new data actually changed before re-processing.

| Endpoint | TTL |
|---|---|
| `/challenge/pantries` | 24 h |
| `/challenge/demographics` | 24 h |
| `/challenge/supply-alerts` | 60 s |
| `/challenge/311-calls` | 5 min |

**Why:** The Challenge API is a shared hackathon resource. Hammering it risks rate limits and degrades performance for all teams. The hash check avoids unnecessary ingestion work on unchanged data.

---

### 4.6 Bilingual Support (EN/ES)
`src/lib/i18n.ts` + `src/contexts/LangContext.tsx`

- Translation dictionary maps keys → `{ en: string; es: string }`.
- Active language stored in a cookie (`lang=en|es`) and read server-side.
- `LangContext` exposes `t(key)` hook to all client components.
- Site-level Spanish access data (languages field on `Site`) drives the allocation language-match score — if 40 %+ of a ZIP is Hispanic, Spanish-capable sites score higher.

**Why cookies vs. URL param:** Persists across navigation without encoding language in every URL, and is readable by server components for SSR.

---

### 4.7 AI Integration (Claude)
`src/lib/ai.ts` + `src/app/api/ai/`

Three uses:

| Endpoint | Input | Output |
|---|---|---|
| `/api/ai/explain` | Allocation + scores | 1–2 sentence plain-English rationale |
| `/api/ai/outreach` | Site + event details | Bilingual outreach message draft |
| Inline in ingest | Alert description text | Structured fields (quantity, perishability) |

Uses `claude-haiku-4-5-20251001` for speed and cost efficiency. **Graceful degradation:** if `ANTHROPIC_API_KEY` is absent, all three paths fall back to deterministic template strings — the app fully functions without AI.

---

## 5. Authentication & Authorization

- **Provider:** Supabase Auth (email + password)
- **Session:** Cookies via `@supabase/ssr` (supports SSR without client-side token flashing)
- **RBAC:** `profiles.role` field controls what operators see within the dashboard
- **Route protection:** `(dashboard)` layout group checks session server-side; unauthenticated requests redirect to `/login`

---

## 6. API Routes

| Route | Method | What it does |
|---|---|---|
| `/api/ingest` | GET | Pulls all Challenge API data, runs scoring, upserts DB |
| `/api/seed` | GET | Seeds test data for development |
| `/api/help-request` | POST | Saves request, sends priority email via Resend, logs analytics |
| `/api/escalate` | GET / POST | Checks/triggers escalation for perishable batches |
| `/api/supply-alerts/poll` | GET | Polls Challenge API for new alerts |
| `/api/ai/explain` | POST | Claude allocation rationale |
| `/api/ai/outreach` | POST | Claude bilingual outreach draft |
| `/api/dispatch/[id]/confirm` | POST | Confirms dispatch action |
| `/api/vote/[id]` | POST | Records community vote with fingerprint |
| `/api/tts` | POST | Text-to-speech for accessibility |

---

## 7. Design System

CSS custom properties in `globals.css` define the brand palette:

| Token | Value | Usage |
|---|---|---|
| `--navy` | `#1B3A52` | Primary brand, dashboard sidebar |
| `--orange` | `#F5A623` | CTAs, alerts, accents |
| `--teal` | `#2D8C7A` | Secondary, health indicators |
| `--sky` | `#4A90C4` | Info states |
| `--sage` | `#6BA87A` | Natural / food-positive indicators |
| `--cream` | `#E8C98A` | Warm backgrounds |

The `NeedScoreBadge` component maps score ranges to these tokens (green → yellow → orange → red) for instant visual triage.

---

## 8. Data Flow — End to End

```
Challenge API
     │
     ▼
/api/ingest  ──► Supabase DB (sites, neighborhood_scores, supply_alerts…)
                      │
         ┌────────────┼──────────────────┐
         ▼            ▼                  ▼
   Operator       Resident           Realtime
  Dashboard        Portal           Subscription
  /dashboard       /map                  │
       │           /site/[id]            ▼
       │           /request-help    Alert banner
       ▼                            in dashboard
  Supply alert
  arrives
       │
       ▼
  Allocation algorithm
  (scoring/allocation.ts)
       │
       ▼
  Claude AI rationale
  (api/ai/explain)
       │
       ▼
  Operator confirms dispatch
  (api/dispatch/[id]/confirm)
       │
       ▼
  Allocation record updated → analytics_event logged
```

---

## 9. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
ANTHROPIC_API_KEY          # optional — app degrades gracefully without it
RESEND_API_KEY
CHALLENGE_API_BASE         # defaults to https://aipromptchamp.com/api
NOTIFICATION_EMAIL         # ops team address for help-request alerts
```

---

## 10. Notable Patterns

- **No global state manager** — Supabase client + React Context (language) + local `useState` is sufficient. No Redux or Zustand.
- **Algorithm over AI** — Scoring and allocation are deterministic code; Claude is additive (explanation + messaging), not decision-critical.
- **Accessibility first** — Radix UI primitives for keyboard nav, TTS endpoint for screen-reader fallback, barrier-aware help request form.
- **Thin API routes** — Business logic lives in `lib/`; route handlers are orchestrators only.
- **TypeScript coverage** — All entities typed end-to-end; no `any` types in production code.
