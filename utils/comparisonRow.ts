import { ComparisonRow } from '../types';

/**
 * Creates an empty ComparisonRow for a given id and location.
 * Use when importing new data or when analysis fails / has no rows.
 */
export function createEmptyComparisonRow(id: string, location: string, concept?: string): ComparisonRow {
  return {
    id,
    location,
    concept,
    service: { points: [] },
    food: { points: [] },
    value: { points: [] },
    atmosphere: { points: [] },
    overallRating: 0,
  };
}
