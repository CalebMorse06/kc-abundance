import type { NeighborhoodScore } from '@/types';

/**
 * Need score formula (already computed during ingestion and stored in DB).
 * This module provides helpers for displaying/using stored scores.
 *
 * Formula used in ingest.ts:
 *   need_score = (
 *     poverty_rate/100 * 0.25
 *     + food_insecurity_pct/100 * 0.25
 *     + no_car_pct/100 * 0.20
 *     + store_closure_impact * 0.15   (people_impacted/50000)
 *     + distress_calls_norm * 0.10    (calls/500)
 *     + food_desert * 0.05
 *   ) * 100
 *   × 1.15 if harvest_priority (capped at 100)
 */

export function needScoreColor(score: number | null): 'red' | 'orange' | 'yellow' | 'green' {
  if (!score) return 'green';
  if (score >= 70) return 'red';
  if (score >= 50) return 'orange';
  if (score >= 30) return 'yellow';
  return 'green';
}

export function needScoreLabel(score: number | null): string {
  if (!score) return 'Unknown';
  if (score >= 70) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

export function needScoreTailwind(score: number | null): string {
  const color = needScoreColor(score);
  const map = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };
  return map[color];
}

export function needScoreTextTailwind(score: number | null): string {
  const color = needScoreColor(score);
  const map = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
    green: 'text-green-600',
  };
  return map[color];
}

/**
 * Get the primary language of a neighborhood based on hispanic_pct.
 * Used for outreach targeting.
 */
export function neighborhoodPrimaryLanguage(score: NeighborhoodScore): 'es' | 'en' {
  return (score.hispanic_pct ?? 0) >= 40 ? 'es' : 'en';
}
