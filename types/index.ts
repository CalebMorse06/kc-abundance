// FoodBridge KC — Type definitions

export type ColdStorageType = 'none' | 'refrigerated' | 'industrial';
export type SiteType = 'food_bank' | 'pantry' | 'mobile' | 'shelter' | 'school' | 'garden' | 'popup';
export type AlertStatus = 'open' | 'in_progress' | 'resolved';
export type BatchStatus = 'unallocated' | 'partially_allocated' | 'allocated' | 'delivered' | 'spoiled';
export type AllocationStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';
export type HelpBarrier = 'no_car' | 'language_barrier' | 'disability' | 'senior' | 'infant';
export type Language = 'en' | 'es';
export type UserRole = 'ops_admin' | 'dispatcher' | 'pantry_manager' | 'outreach_staff' | 'analyst';

export interface ParsedHours {
  day: string;
  open: string;   // "08:00"
  close: string;  // "16:00"
}

export interface Site {
  id: string;
  source: string;
  external_id: string | null;
  name: string;
  address: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  type: SiteType;
  active: boolean;
  hours_raw: string | null;
  hours_parsed: ParsedHours[] | null;
  languages: Language[];
  cold_storage_type: ColdStorageType;
  id_required: boolean;
  capacity_lbs: number | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface NeighborhoodScore {
  zip: string;
  poverty_rate: number | null;
  food_insecurity_pct: number | null;
  no_car_pct: number | null;
  hispanic_pct: number | null;
  distress_calls: number;
  store_closure_impact: number;
  food_desert: boolean;
  harvest_priority: boolean;
  need_score: number | null;
  score_computed_at: string | null;
}

export interface StoreClosure {
  id: string;
  store_name: string;
  zip: string;
  closed_date: string | null;
  people_impacted: number | null;
  source: string;
}

export interface FoodDesertTract {
  tract_id: string;
  zip: string | null;
  food_desert: boolean;
  low_access_1mi: boolean;
  population: number | null;
}

export interface SupplyAlert {
  id: string;
  source: string;
  title: string;
  description: string | null;
  quantity_lbs: number | null;
  perishability_hours: number | null;
  requires_cold: boolean;
  status: AlertStatus;
  alert_type: string | null;
  severity: string | null;
  impacted_zips: string[] | null;
  api_hash: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface FoodBatch {
  id: string;
  alert_id: string | null;
  description: string;
  quantity_lbs: number;
  requires_cold: boolean;
  perishability_hours: number | null;
  spoilage_deadline: string | null;
  status: BatchStatus;
  created_at: string;
}

export interface Allocation {
  id: string;
  batch_id: string;
  site_id: string;
  quantity_lbs: number;
  status: AllocationStatus;
  site_score: number | null;
  rationale: AllocationRationale | null;
  created_at: string;
  site?: Site;
  batch?: FoodBatch;
}

export interface AllocationRationale {
  need: number;
  cold: number;
  language: number;
  capacity: number;
  transit: number;
  total: number;
  explanation: string;
}

export interface AllocationCandidate {
  site: Site;
  score: number;
  rationale: AllocationRationale;
  neighborhood_score: NeighborhoodScore | null;
}

export interface PopupEvent {
  id: string;
  site_id: string | null;
  zip: string | null;
  lead_org: string | null;
  description: string | null;
  description_es: string | null;
  scheduled_at: string;
  ends_at: string | null;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  triggered_by_alert_id: string | null;
  created_at: string;
  site?: Site;
}

export interface HelpRequest {
  id: string;
  zip: string | null;
  barrier_type: HelpBarrier[];
  preferred_language: Language;
  contact_info: string | null;
  notes: string | null;
  status: 'open' | 'assigned' | 'fulfilled' | 'closed';
  created_at: string;
}

export interface CommunityVote {
  id: string;
  zip: string;
  title: string;
  title_es: string | null;
  description: string | null;
  description_es: string | null;
  support_count: number;
  target_count: number;
  deadline: string | null;
  active: boolean;
  result: 'approved' | 'rejected' | 'pending' | null;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  event_type: string;
  zip: string | null;
  site_id: string | null;
  popup_event_id: string | null;
  quantity_lbs: number | null;
  households_served: number | null;
  produce_saved_lbs: number | null;
  notes: string | null;
  occurred_at: string;
}

export interface HarvestPriorityZip {
  zip: string;
  priority: string | null;
  reason: string | null;
  weekly_lbs: number | null;
  agencies: string[] | null;
}

export interface Profile {
  id: string;
  display_name: string | null;
  role: UserRole;
  language_pref: Language;
  zip: string | null;
  created_at: string;
}

// ── Challenge API response shapes (matching actual API) ──────────────────────

export interface ChallengeApiWrapper<T> {
  source: string;
  count?: number;
  data: T[];
}

// Actual pantry shape from API
export interface ChallengePantry {
  id: string;
  name: string;
  address: string;
  zip: string;
  lat: number;
  lng: number;
  hours: string;
  phone: string;
  language: string[];         // ["English", "Spanish"]
  idRequired: boolean;
  type: string;               // "food_bank", "pantry", "mobile_distribution", etc.
  serves: string;
  monthlyCapacity: number;
  coldStorage: boolean;
  coldStorageCapacity?: string; // "industrial", "small_fridge", "walk_in"
  coldStorageNotes?: string;
  scheduledRoutes?: string[];
  routeSchedule?: string;
}

export interface ChallengeStoreClosure {
  name: string;
  address: string;
  zip: string;
  closedDate: string;
  type: string;
  squareFt: number;
  employeesLost: number;
  nearestAlternative: string;
  impactedPopulation: number;
}

export interface ChallengeDemographics {
  zip: string;
  population: number;
  povertyRate: number;
  hispanicPct: number;
  blackPct: number;
  noVehiclePct: number;
  snapPct: number;
  medianAge: number;
  medianIncome: number;
  foodInsecurityRate: number;
  childPovertyRate: number;
}

export interface ChallengeDistressCall {
  zip: string;
  category: string;
  count: number;
  period: string;
  topIssue: string;
  pctChange: number;
}

export interface ChallengeFoodAtlasTract {
  censusTract: string;
  zip: string;
  foodDesert: boolean;
  lowAccess1mi: boolean;
  lowAccess10mi: boolean;
  povertyRate: number;
  medianIncome: number;
  vehicleAccess: number;
  population: number;
  snapHouseholds: number;
}

export interface ChallengeTransitStop {
  stopId: string;
  route: string;         // "31 - 31st Street"
  lat: number;
  lng: number;
  nearPantry: string;    // pantry id this stop is near
  walkMinutes: number;
  frequency: string;     // "30min"
  operatingHours: string; // "5:30am-11pm"
  zip: string;
}

// Supply alerts wrapper shape
export interface ChallengeSupplyAlertsResponse {
  status: string;
  lastUpdated: string;
  alerts: ChallengeSupplyAlertItem[];
}

export interface ChallengeSupplyAlertItem {
  id: string;
  type: string;          // "federal_cut", "demand_spike", "produce_donation", etc.
  severity: string;      // "high", "medium", "low"
  title: string;
  description: string;
  impactedZips: string[];
  date: string;
  source: string;
}

export interface ChallengeHarvestZip {
  zip: string;
  priority: string;      // "critical", "high", "medium"
  reason: string;
  weeklyLbs: number;
  agencies: string[];
  lastDelivery: string;
}
