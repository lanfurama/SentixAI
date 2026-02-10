import type { ComparisonRow, RawReviewData } from '../types';

const API_BASE = '/api';

export async function fetchDatasets(): Promise<RawReviewData[]> {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) throw new Error('Failed to load datasets');
  return res.json();
}

export async function fetchDataset(resortId: string): Promise<RawReviewData> {
  const res = await fetch(`${API_BASE}/datasets/${encodeURIComponent(resortId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to load dataset');
  }
  return res.json();
}

export async function updateDatasetCsv(
  id: string,
  csvContent: string,
  name?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/datasets`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, csvContent }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to save');
  }
}

export async function fetchComparison(): Promise<ComparisonRow[]> {
  const res = await fetch(`${API_BASE}/comparison`);
  if (!res.ok) throw new Error('Failed to load comparison data');
  return res.json();
}

export async function saveComparisonUpdates(updates: ComparisonRow[]): Promise<void> {
  const res = await fetch(`${API_BASE}/comparison`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to save comparison data');
  }
}

export async function analyzeWithApi(
  id: string,
  name: string,
  csvContent: string,
  context?: 'table' | 'item'
): Promise<ComparisonRow> {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, csvContent, context: context ?? 'item' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Analysis failed');
  }
  return res.json();
}
