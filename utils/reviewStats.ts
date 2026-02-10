import type { RawReviewData, TimeFilter } from '../types';
import { filterCsvByTime } from './csvFilter';
import { parseReviews } from './csvParser';

export function getReviewCount(
  datasetId: string,
  rawDatasets: RawReviewData[],
  timeFilter: TimeFilter
): number {
  const ds = rawDatasets.find((d) => d.id === datasetId);
  if (!ds?.csvContent) return 0;
  const months = timeFilter === 'all' ? 'all' : parseFloat(timeFilter);
  const filtered = filterCsvByTime(ds.csvContent, months);
  const reviews = parseReviews(filtered);
  return reviews.length;
}

/** Average rating from raw reviews in the period. Returns 0 if no reviews. */
export function getAverageRatingFromRaw(
  datasetId: string,
  rawDatasets: RawReviewData[],
  timeFilter: TimeFilter
): number {
  const ds = rawDatasets.find((d) => d.id === datasetId);
  if (!ds?.csvContent) return 0;
  const months = timeFilter === 'all' ? 'all' : parseFloat(timeFilter);
  const filtered = filterCsvByTime(ds.csvContent, months);
  const reviews = parseReviews(filtered);
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((s, r) => s + (typeof r.rating === 'number' ? r.rating : 0), 0);
  return sum / reviews.length;
}
