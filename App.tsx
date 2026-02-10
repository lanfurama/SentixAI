import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { ComparisonTable } from './components/ComparisonTable';
import { ReviewList } from './components/ReviewList';
import { CsvPreviewModal } from './components/CsvPreviewModal';
import { DashboardHome } from './components/DashboardHome';
import { TypeDashboard } from './components/TypeDashboard';
import { RETAIL_STORE_IDS, SUPERMARKET_IDS } from './constants';
import { ComparisonRow, TimeFilter, RawReviewData } from './types';
import { fetchDatasets, fetchComparison, fetchDataset, analyzeWithApi, updateDatasetCsv, saveComparisonUpdates } from './services/api';
import { filterCsvByTime } from './utils/csvFilter';
import { createEmptyComparisonRow } from './utils/comparisonRow';
import { mergeReviewsInCsv } from './utils/csvMerge';
import { BrainCircuit, AlertCircle, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [rawDatasets, setRawDatasets] = useState<RawReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiReady, setApiReady] = useState(false);
  const [analyzingGroups, setAnalyzingGroups] = useState<Set<string>>(new Set());
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<{ name: string; content: string } | null>(null);
  const [targetImportItem, setTargetImportItem] = useState<{ id: string; name: string } | null>(null);

  const requestImport = (item: { id: string; name: string }) => {
    setTargetImportItem(item);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewFile({ name: file.name, content: (event.target?.result as string) || '' });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!previewFile || !targetImportItem) return;
    const existing = rawDatasets.find(ds => ds.id === targetImportItem.id);
    const mergedCsv = existing?.csvContent
      ? mergeReviewsInCsv(existing.csvContent, previewFile.content)
      : previewFile.content;

    try {
      await updateDatasetCsv(targetImportItem.id, mergedCsv, targetImportItem.name);
      setRawDatasets(prev =>
        existing
          ? prev.map(ds => (ds.id === targetImportItem.id ? { ...ds, csvContent: mergedCsv } : ds))
          : [...prev, { id: targetImportItem.id, name: targetImportItem.name, csvContent: mergedCsv }]
      );
      if (!data.some(r => r.id === targetImportItem.id)) {
        setData(prev => [createEmptyComparisonRow(targetImportItem.id, targetImportItem.name), ...prev]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu vào file. Kiểm tra server đang chạy.');
    }
    setPreviewFile(null);
    setTargetImportItem(null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [datasets, comparison] = await Promise.all([fetchDatasets(), fetchComparison()]);
        if (!cancelled) {
          setRawDatasets(datasets);
          setData(comparison);
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
    return () => { cancelled = true; };
  }, []);

  const isRetail = (id: string) => (RETAIL_STORE_IDS as readonly string[]).includes(id);
  const isSupermarket = (id: string) => (SUPERMARKET_IDS as readonly string[]).includes(id);

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
            datasets.push({
              id,
              name: existingRow?.location ?? id,
              csvContent: 'author,date,content,rating,source\n',
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

      // Step 2: Analyze sequentially (avoid Gemini rate limit)
      const months = filter === 'all' ? 'all' : parseFloat(filter);
      for (const dataset of datasets) {
        try {
          const filteredCsv = filterCsvByTime(dataset.csvContent, months);
          const rowCount = filteredCsv.trim().split('\n').length;
          if (rowCount <= 1) {
            newResults.push(createEmptyComparisonRow(dataset.id, dataset.name));
            continue;
          }
          const result = await analyzeWithApi(dataset.id, dataset.name, filteredCsv, 'table');
          newResults.push(result);
        } catch (e) {
          console.error(`Failed to analyze ${dataset.name}`, e);
          newResults.push(createEmptyComparisonRow(dataset.id, dataset.name));
        }
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
          setTimeout(() => {
            saveComparisonUpdates(newResults).then(
              () => setError(null),
              (e) => setError(e instanceof Error ? e.message : 'Save failed after retry')
            );
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
        dataset = fallback ?? {
          id: itemId,
          name: existingRow?.location ?? itemId,
          csvContent: 'author,date,content,rating,source\n',
        };
      }
      const months = filter === 'all' ? 'all' : parseFloat(filter);
      const filteredCsv = filterCsvByTime(dataset.csvContent, months);
      const rowCount = filteredCsv.trim().split('\n').length;
      if (rowCount <= 1) {
        const emptyRow = createEmptyComparisonRow(dataset.id, dataset.name);
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

  const retailStores = data.filter(item => isRetail(item.id));
  const supermarkets = data.filter(item => isSupermarket(item.id));
  const restaurants = data.filter(item => !isRetail(item.id) && !isSupermarket(item.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 safe-area-padding">
        <div className="text-slate-500 font-medium text-sm sm:text-base">Loading data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-2 sm:p-3 md:p-4 lg:p-5 pb-8 safe-area-padding">
      <div className="max-w-[1440px] mx-auto space-y-3 sm:space-y-4">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Header error={error} apiReady={apiReady} />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden"
                  aria-hidden="true"
                />
                {restaurants.length > 0 && (
                  <ComparisonTable
                    title="Dining & Venues Analysis"
                    data={restaurants}
                    variant="restaurant"
                    rawDatasets={rawDatasets}
                    isAnalyzing={analyzingGroups.has('restaurants')}
                    onAnalyze={(filter) => handleAnalyzeGroup('restaurants', restaurants.map(r => r.id), filter)}
                    onAnalyzeItem={handleAnalyzeItem}
                    analyzingItemId={analyzingItemId}
                  />
                )}
                {retailStores.length > 0 && (
                  <ComparisonTable
                    title="Retail Stores Performance"
                    data={retailStores}
                    variant="retail"
                    rawDatasets={rawDatasets}
                    isAnalyzing={analyzingGroups.has('retail')}
                    onAnalyze={(filter) => handleAnalyzeGroup('retail', retailStores.map(r => r.id), filter)}
                    onAnalyzeItem={handleAnalyzeItem}
                    analyzingItemId={analyzingItemId}
                  />
                )}
                {supermarkets.length > 0 && (
                  <ComparisonTable
                    title="Hypermarkets & Entertainment"
                    data={supermarkets}
                    variant="supermarket"
                    rawDatasets={rawDatasets}
                    isAnalyzing={analyzingGroups.has('supermarket')}
                    onAnalyze={(filter) => handleAnalyzeGroup('supermarket', supermarkets.map(r => r.id), filter)}
                    onAnalyzeItem={handleAnalyzeItem}
                    analyzingItemId={analyzingItemId}
                  />
                )}
                <p className="text-center text-slate-400 text-xs font-medium py-4 px-2">
                  Sentix AI processes unstructured CSV data into actionable business intelligence.
                </p>
              </>
            }
          />
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/:type" element={<TypeDashboard />} />
          <Route
            path="/reviews/:resortId"
            element={
              <ReviewsPage
                requestImport={requestImport}
              />
            }
          />
        </Routes>

        <CsvPreviewModal
          isOpen={!!previewFile}
          fileName={previewFile?.name || ''}
          csvContent={previewFile?.content || ''}
          targetItemName={targetImportItem?.name}
          onClose={() => { setPreviewFile(null); setTargetImportItem(null); }}
          onConfirm={confirmImport}
        />
      </div>
    </div>
  );
};

function Header({ error, apiReady }: { error: string | null; apiReady: boolean }) {
  return (
    <header className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 sm:gap-6 bg-white p-3 sm:p-4 rounded-lg shadow-sm border-2 border-slate-300">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="bg-emerald-600 p-2.5 sm:p-3 rounded-lg shadow-lg shadow-emerald-200 shrink-0">
          <BrainCircuit className="text-white w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
            Sentix AI
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">v1.0</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5 truncate sm:whitespace-normal">
            Advanced sentiment analysis engine powered by Gemini 3.0
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
        <Link
          to="/dashboard"
          className="text-sm font-semibold text-slate-600 hover:text-emerald-600 px-3 py-2 rounded-md border-2 border-gray-200 hover:border-emerald-300 transition-colors shrink-0"
        >
          Dashboard
        </Link>
        {error && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-3 py-2.5 rounded-md text-xs border-2 border-rose-200 font-semibold w-full sm:max-w-md lg:max-w-sm">
            <AlertCircle size={14} className="shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
        {apiReady && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md text-xs border-2 border-emerald-200 font-bold shrink-0">
            <Sparkles size={14} className="animate-pulse shrink-0" />
            AI Model Active
          </div>
        )}
      </div>
    </header>
  );
}

function ReviewsPage({ requestImport }: { requestImport: (item: { id: string; name: string }) => void }) {
  const { resortId } = useParams<{ resortId: string }>();
  const navigate = useNavigate();
  const [reviewData, setReviewData] = useState<RawReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resortId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDataset(resortId);
        if (!cancelled) {
          setReviewData(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load reviews');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resortId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500 font-medium text-sm">Loading reviews...</div>
      </div>
    );
  }
  if (error || !reviewData) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <p className="text-rose-600 font-medium text-sm">{error || 'Resort not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-emerald-600 hover:text-emerald-700 font-semibold text-sm"
        >
          Back to dashboard
        </button>
      </div>
    );
  }
  return (
    <ReviewList
      reviewData={reviewData}
      onBack={() => navigate('/')}
      onImportCsv={() => requestImport({ id: reviewData.id, name: reviewData.name })}
    />
  );
}

export default App;
