import { SAMPLE_DATA_ANCHOR_DATE } from '../constants';

/**
 * Parses relative and absolute date strings into Date objects.
 * Handles: "3 weeks ago", "8 hours ago", "a day ago", "2026-01-10 15:14:45", "23 hours ago"
 * @param dateStr - Raw date string from CSV
 * @param referenceDate - "Now" for relative dates; defaults to SAMPLE_DATA_ANCHOR_DATE for demo consistency
 */
export const parseDate = (dateStr: string, referenceDate?: Date): Date => {
  const now = referenceDate ?? new Date(SAMPLE_DATA_ANCHOR_DATE);
  const s = dateStr.toLowerCase().trim();

  // Try parsing absolute ISO-like format first
  const absoluteDate = new Date(dateStr);
  if (!isNaN(absoluteDate.getTime())) return absoluteDate;

  // Handle relative formats
  const numMatch = s.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0]) : 1;

  if (s.includes('hour')) return new Date(now.getTime() - num * 60 * 60 * 1000);
  if (s.includes('day')) return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
  if (s.includes('week')) return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
  if (s.includes('month')) return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
  if (s.includes('year')) return new Date(now.getTime() - num * 365 * 24 * 60 * 60 * 1000);

  return now;
};

const findHeaderRowIndex = (rows: string[]): number => {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const lower = rows[i].toLowerCase();
    if (lower.includes('reviewer') || lower.includes('author')) return i;
  }
  return 0;
};

/** Days per "month" for filter windows (Last Week = 0.25 * 30 ≈ 7.5 days, Last Month = 30, etc.) */
const DAYS_PER_MONTH = 30;

/**
 * Filters CSV to only rows whose date falls within the last N months from today.
 * When user selects "Last Month", only data from that window is sent to analyze — correct and minimal.
 */
export const filterCsvByTime = (csvContent: string, months: number | 'all'): string => {
  if (months === 'all') return csvContent;

  const rows = csvContent.trim().split('\n');
  if (rows.length < 2) return csvContent;

  const headerRowIdx = findHeaderRowIndex(rows);
  const header = rows[headerRowIdx];
  const columns = header.toLowerCase().split(',').map(c => c.trim());
  const dateIdx = columns.findIndex(c => c === 'commented_at' || c === 'time' || c === 'date');

  if (dateIdx === -1) return csvContent;

  const now = new Date();
  const cutoff = new Date(now.getTime() - months * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);

  const filteredRows = rows.slice(headerRowIdx + 1).filter(row => {
    const cells = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const dateValue = cells[dateIdx]?.replace(/"/g, '').trim();
    if (!dateValue) return false;
    const parsed = parseDate(dateValue, now);
    return parsed >= cutoff && parsed <= now;
  });

  return [header, ...filteredRows].join('\n');
};

/**
 * Filters CSV to rows whose date falls in [now - startMonthsAgo*DAYS, now - endMonthsAgo*DAYS).
 * E.g. startMonthsAgo=1, endMonthsAgo=0 = last month; startMonthsAgo=2, endMonthsAgo=1 = previous month.
 */
export const filterCsvByTimeRange = (
  csvContent: string,
  startMonthsAgo: number,
  endMonthsAgo: number
): string => {
  if (startMonthsAgo <= endMonthsAgo) return '';

  const rows = csvContent.trim().split('\n');
  if (rows.length < 2) return '';

  const headerRowIdx = findHeaderRowIndex(rows);
  const header = rows[headerRowIdx];
  const columns = header.toLowerCase().split(',').map(c => c.trim());
  const dateIdx = columns.findIndex(c => c === 'commented_at' || c === 'time' || c === 'date');

  if (dateIdx === -1) return '';

  const now = new Date();
  const startCutoff = new Date(now.getTime() - startMonthsAgo * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);
  const endCutoff = new Date(now.getTime() - endMonthsAgo * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);

  const filteredRows = rows.slice(headerRowIdx + 1).filter(row => {
    const cells = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const dateValue = cells[dateIdx]?.replace(/"/g, '').trim();
    if (!dateValue) return false;
    const parsed = parseDate(dateValue, now);
    return parsed >= startCutoff && parsed < endCutoff;
  });

  return [header, ...filteredRows].join('\n');
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Filters CSV to rows whose date falls in [now - startDaysAgo, now - endDaysAgo).
 * E.g. startDaysAgo=7, endDaysAgo=0 = last 7 days; startDaysAgo=14, endDaysAgo=7 = previous 7 days (7–14 days ago).
 */
export const filterCsvByDaysRange = (
  csvContent: string,
  startDaysAgo: number,
  endDaysAgo: number
): string => {
  if (startDaysAgo <= endDaysAgo) return '';

  const rows = csvContent.trim().split('\n');
  if (rows.length < 2) return '';

  const headerRowIdx = findHeaderRowIndex(rows);
  const header = rows[headerRowIdx];
  const columns = header.toLowerCase().split(',').map(c => c.trim());
  const dateIdx = columns.findIndex(c => c === 'commented_at' || c === 'time' || c === 'date');

  if (dateIdx === -1) return '';

  const now = new Date();
  const startCutoff = new Date(now.getTime() - startDaysAgo * MS_PER_DAY);
  const endCutoff = new Date(now.getTime() - endDaysAgo * MS_PER_DAY);

  const filteredRows = rows.slice(headerRowIdx + 1).filter(row => {
    const cells = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const dateValue = cells[dateIdx]?.replace(/"/g, '').trim();
    if (!dateValue) return false;
    const parsed = parseDate(dateValue, now);
    return parsed >= startCutoff && parsed < endCutoff;
  });

  return [header, ...filteredRows].join('\n');
};