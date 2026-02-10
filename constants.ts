
import { TimeFilter } from './types';

/** Anchor date for parsing relative dates in sample data (e.g. "3 weeks ago"). */
export const SAMPLE_DATA_ANCHOR_DATE = '2026-01-11T12:00:00Z';

/** Options for time filter dropdown (used in ComparisonTable and ReviewList). */
export const TIME_FILTER_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '0.25', label: 'Last Week' },
  { value: '1', label: 'Last Month' },
  { value: '3', label: 'Last 3 Months' },
  { value: '6', label: 'Last 6 Months' },
];

/** IDs of venues treated as retail stores (resort_id). */
export const RETAIL_STORE_IDS = ['17', '15', '22'] as const;

/** IDs of venues treated as supermarkets / hypermarkets (resort_id). */
export const SUPERMARKET_IDS = [
  '23',
  '21',
  '10',
  '1',
  '16',
  '11',
  '12',
  '26',
  '27',
  '25',
  '29',
  '28',
  '24',
] as const;
