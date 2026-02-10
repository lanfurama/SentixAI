
import { Review } from '../types';

export const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // Handle CRLF
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  return rows;
};

const isHeaderRow = (row: string[]): boolean => {
  const lower = row.map(c => c.toLowerCase().trim()).join(' ');
  return lower.includes('reviewer') || lower.includes('author');
};

export const parseReviews = (csvContent: string): Review[] => {
  if (!csvContent) return [];
  
  const rows = parseCSV(csvContent);
  if (rows.length < 2) return [];

  // Find header row (supports CSV with metadata rows before header, e.g. Reviewer,Time,Comment,Rating)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (isHeaderRow(rows[i])) {
      headerRowIdx = i;
      break;
    }
  }

  const header = rows[headerRowIdx].map(h => h.toLowerCase().trim());
  // Support both formats: (author|reviewer), (commented_at|time|date), (content|comment), rating, (source)
  const authorIdx = header.findIndex(h => h.includes('author') || h.includes('reviewer'));
  // Date: exact match to avoid "atmosphere" (contains "time"), "updated" etc.
  const dateIdx = header.findIndex(h => h === 'commented_at' || h === 'time' || h === 'date');
  // Content: exact match only - "commented_at" contains "content" and must NOT be used for content
  const contentIdx = header.findIndex(h => h === 'content' || h === 'comment');
  const ratingIdx = header.findIndex(h => h.includes('rating') && !h.includes('overall'));
  const sourceIdx = header.findIndex(h => h.includes('source') || h.includes('souce'));

  if (authorIdx === -1 || contentIdx === -1 || ratingIdx === -1) return [];

  return rows.slice(headerRowIdx + 1).filter(row => row.length > 1).map(cells => {
      const ratingStr = cells[ratingIdx] || '';
      const ratingMatch = ratingStr.match(/(\d+)/);
      const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;

      return {
          author: cells[authorIdx]?.trim() || 'Anonymous',
          date: cells[dateIdx]?.trim() || '',
          content: cells[contentIdx]?.trim() || '',
          rating,
          source: cells[sourceIdx]?.trim() || 'google'
      };
  });
};
