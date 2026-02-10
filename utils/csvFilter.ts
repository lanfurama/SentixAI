import { SAMPLE_DATA_ANCHOR_DATE } from '../constants';
import { parseCSV } from './csvParser';

/**
 * Parses relative and absolute date strings into Date objects.
 * Handles: "3 weeks ago", ISO strings, Unix timestamp, dd/mm/yyyy, dd-mm-yyyy.
 * @param dateStr - Raw date string from CSV
 * @param referenceDate - "Now" for relative dates; defaults to SAMPLE_DATA_ANCHOR_DATE for demo consistency
 */
export const parseDate = (dateStr: string, referenceDate?: Date): Date => {
  const now = referenceDate ?? new Date(SAMPLE_DATA_ANCHOR_DATE);
  const s = dateStr.trim();
  const lower = s.toLowerCase();

  // Unix timestamp (seconds)
  const unixSec = /^\d{10}$/.test(s) ? parseInt(s, 10) : NaN;
  if (!isNaN(unixSec)) return new Date(unixSec * 1000);

  // Relative formats
  const numMatch = lower.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0]) : 1;
  if (lower.includes('hour')) return new Date(now.getTime() - num * 60 * 60 * 1000);
  if (lower.includes('day')) return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
  if (lower.includes('week')) return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
  if (lower.includes('month')) return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
  if (lower.includes('year')) return new Date(now.getTime() - num * 365 * 24 * 60 * 60 * 1000);

  // dd/mm/yyyy or dd-mm-yyyy (Vietnam/EU format) - new Date() parses mm/dd/yyyy in US locale
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s|T|$)/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const day = parseInt(d!, 10);
    const month = parseInt(m!, 10) - 1;
    const year = parseInt(y!, 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // yyyy-mm-dd or ISO
  const absoluteDate = new Date(s);
  if (!isNaN(absoluteDate.getTime())) return absoluteDate;

  return now;
};

const findHeaderRowIndex = (rows: string[][]): number => {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const lower = rows[i].map(c => c.toLowerCase()).join(' ');
    if (lower.includes('reviewer') || lower.includes('author')) return i;
  }
  return 0;
};

/** Days per "month" for filter windows (Last Month = 30, etc.) */
const DAYS_PER_MONTH = 30;

/** Last Week = from 1st of current month to today (e.g. 10/02 → 01/02–10/02) */
const LAST_WEEK_MONTHS = 0.25;

/** Serialize rows back to CSV string */
const rowsToCsv = (headerRow: string[], dataRows: string[][]): string => {
  const toLine = (cells: string[]) =>
    cells.map(c => (/[,"\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',');
  return [toLine(headerRow), ...dataRows.map(toLine)].join('\n');
};

/**
 * Filters CSV to only rows whose date falls within the last N months from today.
 * When user selects "Last Month", only data from that window is sent to analyze — correct and minimal.
 * Uses parseCSV for robust handling of content with commas.
 */
export const filterCsvByTime = (csvContent: string, months: number | 'all'): string => {
  if (months === 'all') return csvContent;

  const rows = parseCSV(csvContent.trim());
  if (rows.length < 2) return csvContent;

  const headerRowIdx = findHeaderRowIndex(rows);
  const headerRow = rows[headerRowIdx];
  const columns = headerRow.map(h => h.toLowerCase().trim());
  const dateIdx = columns.findIndex(c => c === 'commented_at' || c === 'time' || c === 'date');

  if (dateIdx === -1) return csvContent;

  const now = new Date();
  const cutoff =
    months === LAST_WEEK_MONTHS
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getTime() - months * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);

  const filteredRows = rows.slice(headerRowIdx + 1).filter(row => {
    const dateValue = row[dateIdx]?.replace(/"/g, '').trim();
    if (!dateValue) return false;
    const parsed = parseDate(dateValue, now);
    return parsed >= cutoff && parsed <= now;
  });

  return rowsToCsv(headerRow, filteredRows);
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

  const rows = parseCSV(csvContent.trim());
  if (rows.length < 2) return '';

  const headerRowIdx = findHeaderRowIndex(rows);
  const headerRow = rows[headerRowIdx];
  const columns = headerRow.map(h => h.toLowerCase().trim());
  const dateIdx = columns.findIndex(c => c === 'commented_at' || c === 'time' || c === 'date');

  if (dateIdx === -1) return '';

  const now = new Date();
  const startCutoff = new Date(now.getTime() - startMonthsAgo * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);
  const endCutoff = new Date(now.getTime() - endMonthsAgo * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);

  const filteredRows = rows.slice(headerRowIdx + 1).filter(row => {
    const dateValue = row[dateIdx]?.replace(/"/g, '').trim();
    if (!dateValue) return false;
    const parsed = parseDate(dateValue, now);
    return parsed >= startCutoff && parsed < endCutoff;
  });

  return rowsToCsv(headerRow, filteredRows);
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

  const rows = parseCSV(csvContent.trim());
  if (rows.length < 2) return '';

  const headerRowIdx = findHeaderRowIndex(rows);
  const headerRow = rows[headerRowIdx];
  const columns = headerRow.map(h => h.toLowerCase().trim());
  const dateIdx = columns.findIndex(c => c === 'commented_at' || c === 'time' || c === 'date');

  if (dateIdx === -1) return '';

  const now = new Date();
  const startCutoff = new Date(now.getTime() - startDaysAgo * MS_PER_DAY);
  const endCutoff = new Date(now.getTime() - endDaysAgo * MS_PER_DAY);

  const filteredRows = rows.slice(headerRowIdx + 1).filter(row => {
    const dateValue = row[dateIdx]?.replace(/"/g, '').trim();
    if (!dateValue) return false;
    const parsed = parseDate(dateValue, now);
    return parsed >= startCutoff && parsed < endCutoff;
  });

  return rowsToCsv(headerRow, filteredRows);
};