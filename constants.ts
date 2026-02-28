
import { TimeFilter } from './types';

/** Anchor date for parsing relative dates in sample data (e.g. "3 weeks ago"). */
export const SAMPLE_DATA_ANCHOR_DATE = '2026-01-11T12:00:00Z';

/** Last Week = from 1st of current month to today (e.g. 10/02 → 01/02–10/02) */
export const LAST_WEEK_FILTER_VALUE = '0.25';

/** Options for time filter dropdown (used in ComparisonTable and ReviewList). */
export const TIME_FILTER_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: '0.25', label: 'Last Week' },
  { value: '1', label: 'Last Month' },
  { value: '3', label: 'Last 3 Months' },
  { value: '6', label: 'Last 6 Months' },
];

// Note: SUPERMARKET_IDS and RETAIL_STORE_IDS have been moved to config/venues.js
// Use getVenueIdsByConcept() from config/venues.js instead
