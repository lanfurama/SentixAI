import { useState, useEffect, useRef } from 'react';
import { ComparisonRow, TimeFilter, RawReviewData } from '../types';
import { fetchDatasets, fetchComparison, fetchDataset, analyzeWithApi, saveComparisonUpdates } from '../services/api';
import { filterCsvByTime } from '../utils/csvFilter';
import { createEmptyComparisonRow } from '../utils/comparisonRow';
import { getVenueById } from '../config/venues.js';

export function useComparisonData() {
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [rawDatasets, setRawDatasets] = useState<RawReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiReady, setApiReady] = useState(false);
  const [analyzingGroups, setAnalyzingGroups] = useState<Set<string>>(new Set());
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Only fetch comparison data initially (fast, from JSON file)
        // Datasets will be fetched lazily when needed (on analyze)
        const comparison = await fetchComparison();
        if (!cancelled) {
          // Ensure all rows have concept field from VENUES config
          const enrichedComparison = comparison.map((row) => {
            if (!row.concept) {
              const venue = getVenueById(row.id);
              if (venue?.concept) {
                return { ...row, concept: venue.concept };
              }
            }
            return row;
          });
          setData(enrichedComparison);
          setApiReady(true);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError('Could not load data. Is the API server running? Run: npm run server');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    
    return () => {
      cancelled = true;
      // Cleanup retry timeout on unmount
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  const handleAnalyzeGroup = async (groupId: string, idsToAnalyze: string[], filter: TimeFilter) => {
    if (!apiReady) {
      setError('API not ready. Start the server with: npm run server');
      return;
    }

    setAnalyzingGroups(prev => new Set(prev).add(groupId));
    setError(null);

    const newResults: ComparisonRow[] = [];

    try {
      // Step 1: Fetch all resort datasets in parallel
      const fetchResults = await Promise.allSettled(
        idsToAnalyze.map((id) => fetchDataset(id))
      );

      const datasets: RawReviewData[] = [];
      for (let i = 0; i < idsToAnalyze.length; i++) {
        const id = idsToAnalyze[i];
        const settled = fetchResults[i];
        if (settled.status === 'fulfilled') {
          datasets.push(settled.value);
        } else {
          const fallback = rawDatasets.find((ds) => ds.id === id);
          if (fallback) {
            datasets.push(fallback);
          } else {
            const existingRow = data.find((r) => r.id === id);
            const venue = getVenueById(id);
            datasets.push({
              id,
              name: existingRow?.location ?? venue?.name ?? id,
              csvContent: 'author,date,content,rating,source\n',
              concept: venue?.concept,
            });
          }
        }
      }

      // Optional: update rawDatasets cache with successfully fetched data
      const fetched = fetchResults
        .filter((r): r is PromiseFulfilledResult<RawReviewData> => r.status === 'fulfilled')
        .map((r) => r.value);
      if (fetched.length > 0) {
        setRawDatasets((prev) => {
          const next = [...prev];
          fetched.forEach((ds) => {
            const idx = next.findIndex((d) => d.id === ds.id);
            if (idx >= 0) next[idx] = ds;
            else next.push(ds);
          });
          return next;
        });
      }

      // Step 2: Analyze with concurrency limit (2) to balance speed vs Gemini rate limit
      const ANALYZE_CONCURRENCY = 2;
      const months = filter === 'all' ? 'all' : parseFloat(filter);
      const analyzeOne = async (dataset: RawReviewData): Promise<ComparisonRow> => {
        const filteredCsv = filterCsvByTime(dataset.csvContent, months);
        const rowCount = filteredCsv.trim().split('\n').length;
        if (rowCount <= 1) return createEmptyComparisonRow(dataset.id, dataset.name, dataset.concept);
        try {
          const result = await analyzeWithApi(dataset.id, dataset.name, filteredCsv, 'table');
          // Ensure concept is preserved
          if (dataset.concept && !result.concept) {
            result.concept = dataset.concept;
          }
          return result;
        } catch (e) {
          console.error(`Failed to analyze ${dataset.name}`, e);
          return createEmptyComparisonRow(dataset.id, dataset.name, dataset.concept);
        }
      };
      for (let i = 0; i < datasets.length; i += ANALYZE_CONCURRENCY) {
        const chunk = datasets.slice(i, i + ANALYZE_CONCURRENCY);
        const chunkResults = await Promise.all(chunk.map(analyzeOne));
        newResults.push(...chunkResults);
      }

      // Step 3: Merge into state
      if (newResults.length > 0) {
        const updatedData = [...data];
        newResults.forEach((newRow) => {
          const idx = updatedData.findIndex((r) => r.id === newRow.id);
          if (idx !== -1) {
            updatedData[idx] = newRow;
          } else {
            updatedData.unshift(newRow);
          }
        });
        setData(updatedData);

        // Step 4: Persist to comparison-data.json (PATCH merge)
        try {
          await saveComparisonUpdates(newResults);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save comparison data');
          // Clear any existing retry timeout
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          // Retry after delay
          retryTimeoutRef.current = setTimeout(() => {
            saveComparisonUpdates(newResults).then(
              () => setError(null),
              (e) => setError(e instanceof Error ? e.message : 'Save failed after retry')
            );
            retryTimeoutRef.current = null;
          }, 1000);
        }
      }
    } catch (err) {
      setError(`An error occurred analyzing ${groupId}.`);
    } finally {
      setAnalyzingGroups((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const handleAnalyzeItem = async (itemId: string, filter: TimeFilter) => {
    if (!apiReady) {
      setError('API not ready. Start the server with: npm run server');
      return;
    }
    setAnalyzingItemId(itemId);
    setError(null);
    try {
      let dataset: RawReviewData;
      try {
        dataset = await fetchDataset(itemId);
      } catch {
        const fallback = rawDatasets.find((ds) => ds.id === itemId);
        const existingRow = data.find((r) => r.id === itemId);
        const venue = getVenueById(itemId);
        dataset = fallback ?? {
          id: itemId,
          name: existingRow?.location ?? venue?.name ?? itemId,
          csvContent: 'author,date,content,rating,source\n',
          concept: venue?.concept,
        };
      }
      const months = filter === 'all' ? 'all' : parseFloat(filter);
      const filteredCsv = filterCsvByTime(dataset.csvContent, months);
      const rowCount = filteredCsv.trim().split('\n').length;
      if (rowCount <= 1) {
        const emptyRow = createEmptyComparisonRow(dataset.id, dataset.name, dataset.concept);
        setData((prev) => {
          const next = [...prev];
          const idx = next.findIndex((r) => r.id === itemId);
          if (idx !== -1) next[idx] = emptyRow;
          else next.unshift(emptyRow);
          return next;
        });
        await saveComparisonUpdates([emptyRow]);
        return;
      }
      const result = await analyzeWithApi(dataset.id, dataset.name, filteredCsv, 'item');
      // Ensure concept is preserved
      if (dataset.concept && !result.concept) {
        result.concept = dataset.concept;
      }
      setData((prev) => {
        const next = [...prev];
        const idx = next.findIndex((r) => r.id === itemId);
        if (idx !== -1) next[idx] = result;
        else next.unshift(result);
        return next;
      });
      await saveComparisonUpdates([result]);
      // Server also writes to comparison-data.json on analyze; this syncs client state with file
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze item');
    } finally {
      setAnalyzingItemId(null);
    }
  };

  return {
    data,
    rawDatasets,
    loading,
    error,
    apiReady,
    handleAnalyzeGroup,
    handleAnalyzeItem,
    analyzingGroups,
    analyzingItemId,
  };
}
