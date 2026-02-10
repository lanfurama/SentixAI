import { Review } from '../types';
import { parseReviews } from './csvParser';

const escapeCsvCell = (value: string): string => {
  if (value == null) return '';
  const s = String(value).trim();
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/** Serialize Review[] to CSV string (canonical format: author,date,content,rating,source) */
export const serializeReviews = (reviews: Review[]): string => {
  const header = 'author,date,content,rating,source';
  const rows = reviews.map(r =>
    [r.author, r.date, r.content, r.rating, r.source].map(escapeCsvCell).join(',')
  );
  return [header, ...rows].join('\n');
};

/** Normalize string for fingerprint: trim, lowercase, collapse whitespace */
const normalize = (s: string): string =>
  (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Fingerprint for deduplication (author + content + rating) - excludes date so we can update time on duplicate */
const fingerprintNoDate = (r: Review): string => {
  const a = normalize(r.author || '');
  const c = normalize(r.content || '');
  const rating = String(r.rating ?? '');
  return `${a}|${c}|${rating}`;
};

/**
 * Merge new CSV content into existing. NEVER removes old data.
 * - Keeps 100% of existing reviews
 * - Duplicate = same author + content + rating. When duplicate found with different time → update existing's time to new CSV
 * - Appends only reviews that don't already exist
 * - If existing can't be parsed but has content → preserve existing, no overwrite
 */
export const mergeReviewsInCsv = (existingCsv: string, newCsv: string): string => {
  if (!existingCsv || typeof existingCsv !== 'string') {
    return newCsv || '';
  }
  if (!newCsv || typeof newCsv !== 'string') {
    return existingCsv;
  }

  const existingReviews = parseReviews(existingCsv);
  const newReviews = parseReviews(newCsv);

  // Safeguard: existing has content but we couldn't parse it → preserve, don't overwrite
  const existingHasContent = existingCsv.trim().split(/\r?\n/).length > 1;
  if (existingHasContent && existingReviews.length === 0) {
    return existingCsv;
  }

  if (newReviews.length === 0) return existingCsv;

  const existingByKey = new Map<string, number>();
  existingReviews.forEach((r, i) => {
    const key = fingerprintNoDate(r);
    if (!existingByKey.has(key)) existingByKey.set(key, i);
  });

  const seenNewKeys = new Set<string>();
  for (const newR of newReviews) {
    const key = fingerprintNoDate(newR);
    if (existingByKey.has(key)) {
      const idx = existingByKey.get(key)!;
      existingReviews[idx].date = newR.date;
    } else if (!seenNewKeys.has(key)) {
      seenNewKeys.add(key);
      existingReviews.push(newR);
      existingByKey.set(key, existingReviews.length - 1);
    }
  }

  return serializeReviews(existingReviews);
};
