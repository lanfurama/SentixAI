import React from 'react';
import { Link } from 'react-router-dom';
import { ComparisonTable } from '../components/ComparisonTable';
import { useComparisonData } from '../hooks/useComparisonData';
import { BrainCircuit, AlertCircle, Sparkles } from 'lucide-react';

export const DiningPage: React.FC = () => {
  const {
    data,
    rawDatasets,
    loading,
    error,
    apiReady,
    handleAnalyzeGroup,
    handleAnalyzeItem,
    analyzingGroups,
    analyzingItemId,
  } = useComparisonData();

  const restaurants = data.filter(item => item.concept === 'dining');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 safe-area-padding">
        <div className="text-slate-500 font-medium text-sm sm:text-base">Loading data...</div>
      </div>
    );
  }

  return (
    <>
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
            to="/"
            className="text-sm font-semibold text-slate-600 hover:text-emerald-600 px-3 py-2 rounded-md border-2 border-gray-200 hover:border-emerald-300 transition-colors shrink-0"
          >
            Home
          </Link>
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
    </>
  );
};
