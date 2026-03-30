# Abundance-KC — FoodBridge Kansas City

> AI-powered food logistics platform connecting Kansas City families with free food resources while giving operators real-time allocation intelligence.

Built for the **AI Prompt Champ Hackathon** — a full-stack food access coordination system that bridges supply-side food banks and pantries with demand-side residents through two distinct interfaces: a public-facing bilingual resident portal and a gated operator dashboard with AI-driven allocation tooling.

---

## The Problem

Kansas City has a fragmented food distribution network. Food banks receive donations and must quickly route them to pantries across dozens of ZIP codes — but without real-time visibility into where need is highest, how much capacity each site has, or whether food will spoil before it reaches families. Residents, especially Spanish-speaking households and those without cars, have no easy way to find food near them that matches their situation.

Abundance-KC fixes both sides of this equation.

---

## Features

### Resident Portal (Public)

| Feature | Description |
|---|---|
| **Interactive Food Map** | Mapbox-powered site finder with ZIP search, filters for open now / Spanish spoken / no ID required / bus-accessible / fresh produce available |
| **Site Detail Pages** | Full pantry profiles with hours, languages, cold storage, capacity, community need score, and nearby transit |
| **Help Request Form** | Residents with barriers (no car, disability, language, senior, infant) submit requests that trigger structured email alerts to the ops team |
| **Community Voting** | Residents vote for which neighborhood should receive the next popup market — tracks progress toward a goal |
| **Bilingual (EN/ES)** | Every public page fully translated; language persisted in cookie; priority for Spanish-speaking households |
| **Text-to-Speech** | ElevenLabs-powered audio narration for accessibility on site detail pages |

### Operator Dashboard (Auth-Gated)

| Feature | Description |
|---|---|
| **Command Center** | Live stats (active alerts, sites, lbs in flow, critical ZIPs), AI-generated operational insights via GPT-4o-mini, recent activity feed, realtime Supabase subscriptions |
| **Supply Alert Triage** | Live supply alerts polled from the Challenge API every 60 seconds, with perishability countdowns, cold storage flags, and severity tiers |
| **AI Allocation Scoring** | For each food batch, Claude scores every active site across 5 weighted factors (need 30%, cold storage 25%, language 20%, capacity 15%, transit 10%) — instant ranked recommendations |
| **Distribution Map** | Full-city operational map with animated allocation flow lines, ZIP need heatmap, food desert overlays, coverage gap detection, and site markers by type |
| **AI Allocation Plan** | GPT-4o-mini analyzes current network utilization and proposes pantry-to-pantry rebalancing transfers — surplus sites give to under-served high-need sites, visualized as cyan dashed flow lines |
| **Escalation Engine** | Automatically detects perishable batches approaching spoilage deadline (25% time remaining), fires an alert, and auto-creates emergency popup events in the highest-need reachable ZIP |
| **Analytics** | Historical metrics — lbs distributed, households served, produce saved, event timelines |
| **Role-Based Access** | Five operator roles: `ops_admin`, `dispatcher`, `pantry_manager`, `outreach_staff`, `analyst` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + Radix UI primitives |
| Database | Supabase (Postgres + Auth + Realtime) |
| Maps | Mapbox GL JS + react-map-gl |
| AI — Allocation explanations | Anthropic Claude (`claude-haiku-4-5-20251001`) |
| AI — Insights & planning | OpenAI GPT-4o-mini |
| External data | Challenge API (aipromptchamp.com) |
| Text-to-Speech | ElevenLabs multilingual v2 |
| Email | Resend |
| Icons | Lucide React |
| React | 19.2.4 |

---

## Architecture

```
┌─ EXTERNAL DATA SOURCES ──────────────────────────────────────────────────┐
│                                                                            │
│  Challenge API (aipromptchamp.com)            Manual / Operator Input     │
│  ├─ /challenge/pantries                       ├─ Supply alert forms       │
│  ├─ /challenge/demographics                   ├─ Site edits               │
│  ├─ /challenge/food-atlas (USDA)              └─ /api/seed (demo data)    │
│  ├─ /challenge/311-calls                                                   │
│  ├─ /challenge/store-closures                                              │
│  ├─ /challenge/supply-alerts  ◄── polled every 60s                        │
│  ├─ /challenge/transit-stops                                               │
│  └─ /challenge/harvest-zips                                                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                  ┌─ INGEST PIPELINE (/api/ingest) ──────────┐
                  │  Normalize · Score · Deduplicate          │
                  │  TTL cache · Upsert to Supabase           │
                  └──────────────────────────────────────────┘
                                      │
                                      ▼
┌─ SUPABASE POSTGRES ────────────────────────────────────────────────────────┐
│  sites  neighborhood_scores  supply_alerts  food_batches  allocations       │
│  popup_events  help_requests  community_votes  analytics_events             │
│  food_desert_tracts  store_closures  harvest_priority_zips  profiles        │
└────────────────────────────────────────────────────────────────────────────┘
            │                       │                         │
            ▼                       ▼                         ▼
   ┌─ SCORING ────┐       ┌─ AI LAYER ──────────┐    ┌─ ESCALATION ──────────┐
   │ 5-factor     │       │ Claude: explanations │    │ Monitor perishability  │
   │ allocation   │       │ Claude: outreach     │    │ Auto-create popups     │
   │ scoring      │       │ GPT-4o: insights     │    │ Bilingual alerts       │
   └──────────────┘       │ GPT-4o: alloc. plan  │    └───────────────────────┘
                          └─────────────────────┘
                                      │
              ┌───────────────────────┴──────────────────────┐
              ▼                                               ▼
   ┌─ OPERATOR DASHBOARD ──────────────────┐    ┌─ RESIDENT PORTAL ──────────┐
   │  /dashboard  (auth-gated)             │    │  /  (public)               │
   │  ├─ Command Center + AI Insights      │    │  ├─ Homepage                │
   │  ├─ Supply alerts + batch management  │    │  ├─ Food map (/map)         │
   │  ├─ Allocation scoring + confirmation │    │  ├─ Site detail (/site/id)  │
   │  ├─ Distribution map + AI Plan        │    │  ├─ Request help            │
   │  └─ Analytics                         │    │  └─ Community voting        │
   └───────────────────────────────────────┘    └────────────────────────────┘
```

### Allocation Scoring

Every site is scored against a food batch using five weighted factors:

```
site_score = (
  neighborhood_need_score × 0.30   // USDA food insecurity + poverty + distress calls
  + cold_storage_match    × 0.25   // 1.0 if match; hard exclusion if required but missing
  + language_match        × 0.20   // site languages vs ZIP primary language
  + capacity_headroom     × 0.15   // available lbs relative to batch size
  + transit_accessible    × 0.10   // bus stops within walking distance
) × 100
```

A site is hard-excluded if a batch requires cold storage and the site has `cold_storage_type = 'none'`. Language match sets Spanish as the primary language for any ZIP where `hispanic_pct ≥ 40%`.

### AI Allocation Plan

The `/api/ai/allocation-plan` endpoint classifies every active site by utilization before prompting GPT-4o-mini for a rebalancing proposal:

| Status | Condition | Role |
|---|---|---|
| **Surplus** | ≥70% of capacity allocated | Can give food away |
| **Balanced** | 30–70% full | Neutral |
| **Under-served** | <30% full, need_score ≥ 50 | Priority receiver |
| **Unserved** | No allocations at all | Priority receiver |

The model receives the full network state, explicit surplus/under-served breakdowns, and coverage gap ZIPs, then returns 4–6 specific transfers with quantities, reasoning, and priority tiers (`critical` / `high` / `medium`). These appear on the distribution map as cyan dashed flow lines separate from confirmed orange allocation flows.

### Escalation Engine

When a perishable food batch has less than 25% of its time window remaining and hasn't been fully allocated:

1. The engine identifies the highest-need reachable ZIP with no current popup event
2. Auto-creates an emergency `PopupEvent` with bilingual (EN + ES) description drafted by Claude
3. Fires a real-time alert in the operator Command Center

Threshold: `max(2h, perishability_hours × 0.25)`

---

## Data Model

```typescript
type SiteType         = 'food_bank' | 'pantry' | 'mobile' | 'shelter' | 'school' | 'garden' | 'popup'
type ColdStorageType  = 'none' | 'refrigerated' | 'industrial'
type AlertStatus      = 'open' | 'in_progress' | 'resolved'
type BatchStatus      = 'unallocated' | 'partially_allocated' | 'allocated' | 'delivered' | 'spoiled'
type AllocationStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled'
type HelpBarrier      = 'no_car' | 'language_barrier' | 'disability' | 'senior' | 'infant'
type UserRole         = 'ops_admin' | 'dispatcher' | 'pantry_manager' | 'outreach_staff' | 'analyst'
```

Core data flow: `SupplyAlert` → `FoodBatch` → `Allocation` → `AnalyticsEvent`

Parallel path: `FoodBatch` (near spoilage) → `PopupEvent` (emergency distribution)

Full type definitions in [`types/index.ts`](./types/index.ts).

---

## Neighborhood Need Score

Each ZIP code receives a composite `need_score` (0–100) computed from:

- USDA food insecurity rate
- Poverty rate (Census)
- No-vehicle household percentage
- 311 distress call volume
- Store closure impact (grocers closed in the past year)
- USDA food desert designation

| Score | Label | Map Color |
|---|---|---|
| ≥ 70 | Critical | Red |
| 50–69 | High | Orange |
| 30–49 | Medium | Yellow |
| < 30 | Low | Green |

**Coverage gap detection** highlights ZIPs with `need_score ≥ 60` that have no active food site. These appear as pulsing red markers on the distribution map.

---

## API Routes

### AI

| Route | Method | Description |
|---|---|---|
| `/api/ai/allocation-plan` | GET | Analyzes network utilization; proposes pantry-to-pantry transfers via GPT-4o-mini |
| `/api/ai/insights` | GET | Full operational snapshot → 3–5 prioritized recommendations (GPT-4o-mini) |
| `/api/ai/explain` | POST | 1–2 sentence plain-English allocation rationale (Claude) |
| `/api/ai/outreach` | POST | Bilingual SMS/flyer copy for a popup event (Claude) |

### Supply Chain

| Route | Method | Description |
|---|---|---|
| `/api/supply-alerts/poll` | GET | Poll Challenge API for new alerts; extract fields via Claude; run escalation sweep |
| `/api/escalate` | GET | Escalation status for all open perishable batches |
| `/api/escalate` | POST | Force-escalate a specific alert or run a full sweep |
| `/api/dispatch/[id]/confirm` | POST | Operator confirms an allocation |

### Data

| Route | Method | Description |
|---|---|---|
| `/api/ingest` | GET | Master pipeline — fetch all Challenge API endpoints, normalize, upsert to Supabase |
| `/api/seed` | GET | Load demo data (sample alerts, batches, popup events, votes) |

### Resident

| Route | Method | Description |
|---|---|---|
| `/api/help-request` | POST | Resident submits help request; sends structured email via Resend |
| `/api/vote/[id]` | POST | Adds a support vote to a community campaign |
| `/api/tts` | POST | Generate and cache ElevenLabs audio for a text string |

---

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project with the schema applied
- API keys for Mapbox, OpenAI, ElevenLabs, Resend (Anthropic is optional — the app falls back gracefully)

### Setup

```bash
git clone https://github.com/<your-org>/kc-abundance
cd kc-abundance
npm install
```

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Maps
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...

# AI
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...        # optional, app falls back gracefully

# Challenge API (hackathon data source)
CHALLENGE_API_BASE=https://aipromptchamp.com/api

# Notifications
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL=ops@yourorg.com

# Text-to-Speech
ELEVENLABS_API_KEY=sk_...
```

### Run

```bash
npm run dev
# → http://localhost:3000
```

### Initialize Data

```bash
# Pull live data from the Challenge API (pantries, demographics, transit, etc.)
curl http://localhost:3000/api/ingest

# Load sample supply alerts, batches, and popup events
curl http://localhost:3000/api/seed
```

After ingest, the distribution map will show real KC pantry locations with need score heatmaps. After seeding, allocation flow lines appear and the AI Plan feature has real network data to analyze.

---

## Project Structure

```
kc-abundance/
├── app/
│   ├── (dashboard)/dashboard/   # Auth-gated operator UI
│   │   ├── page.tsx             # Command Center
│   │   ├── map/page.tsx         # Distribution map + AI Plan
│   │   ├── supply/              # Supply alerts + allocation
│   │   ├── sites/               # Site management
│   │   └── analytics/           # Historical metrics
│   ├── (public)/                # Resident-facing pages
│   │   ├── page.tsx             # Homepage
│   │   ├── map/                 # Food finder map
│   │   ├── site/[id]/           # Site detail
│   │   ├── request-help/        # Help request form
│   │   └── community/[zip]/     # Community voting
│   ├── api/                     # All API route handlers
│   └── globals.css              # CSS variables + base styles
├── components/
│   ├── DistributionMap.tsx      # Mapbox operational map with real + proposed flows
│   ├── SpeakButton.tsx          # ElevenLabs TTS trigger
│   └── ui/                      # Radix-based component primitives
├── lib/
│   ├── ai.ts                    # Claude API client + graceful fallbacks
│   ├── escalation.ts            # Perishability monitoring + auto-popup logic
│   ├── ingest.ts                # Challenge API ingestion pipeline
│   ├── seed.ts                  # Demo data initialization
│   ├── i18n.ts                  # EN/ES translation dictionary + React hook
│   ├── scoring/
│   │   ├── allocation.ts        # 5-factor weighted site scoring
│   │   └── need.ts              # Need score color/label utilities
│   ├── api/challenge.ts         # Challenge API client with TTL caching
│   └── supabase/                # Browser + server Supabase client factories
└── types/
    └── index.ts                 # All TypeScript interfaces and union types
```

---

## Bilingual Support

All public-facing strings live in `/lib/i18n.ts` as a flat EN/ES dictionary. Language is controlled by a `LangContext` React context, persisted in a cookie, and toggled via the language switcher in the public nav. The ElevenLabs TTS endpoint uses `eleven_multilingual_v2`. All Claude-generated outreach copy is returned as `{ en: string; es: string }` pairs. Spanish is treated as the primary language for any ZIP code where `hispanic_pct ≥ 40%` — this flows into allocation scoring and site matching.

---

## Contributing

This was built as a hackathon project with the intent of demonstrating what a real production food logistics platform could look like. The architecture is deliberately production-grade — proper TypeScript types throughout, graceful AI fallbacks, TTL caching, realtime Supabase subscriptions, and role-based access scaffolding — so it serves as a meaningful foundation for real deployment.

If you're working on food access in Kansas City or want to adapt this for another city, reach out.

---

## License

MIT
