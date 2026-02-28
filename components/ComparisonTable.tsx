import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ComparisonRow, CategoryAnalysis, TimeFilter, RawReviewData } from '../types';
import { TIME_FILTER_OPTIONS } from '../constants';
import { getReviewCount, getAverageRatingFromRaw } from '../utils/reviewStats';
import { PlusCircle, MinusCircle, RefreshCw, Calendar, Info, List } from 'lucide-react';

interface Props {
  data: ComparisonRow[];
  title: string;
  variant?: 'restaurant' | 'retail' | 'supermarket';
  rawDatasets: RawReviewData[];
  onAnalyze: (filter: TimeFilter) => void;
  isAnalyzing: boolean;
  onAnalyzeItem?: (rowId: string, filter: TimeFilter) => void;
  analyzingItemId?: string | null;
}

const emptyLabel = 'Không có dữ liệu để phân tích';

const MAX_POINTS_VISIBLE = 3;

const CategoryPoints: React.FC<{ category: CategoryAnalysis; compact?: boolean }> = ({ category, compact }) => {
  const points = category?.points ?? [];
  const hasContent = points.length > 0;

  if (!hasContent) {
    return (
      <div className="flex items-center gap-1.5 text-gray-400">
        <Info size={compact ? 12 : 14} className="opacity-40 shrink-0" />
        <span className={`font-medium italic opacity-60 ${compact ? 'text-[11px]' : 'text-xs'}`}>{emptyLabel}</span>
      </div>
    );
  }

  const visiblePoints = points.slice(0, MAX_POINTS_VISIBLE);

  return (
    <div className="flex flex-col gap-1 sm:gap-1.5">
      {visiblePoints.map((point, idx) => (
        <div key={idx} className="flex items-start gap-2 sm:gap-2.5">
          <span className="mt-0.5 shrink-0">
            {point.type === 'positive' ? (
              <PlusCircle size={compact ? 14 : 15} className="fill-[#10b981] text-white" />
            ) : (
              <MinusCircle size={compact ? 14 : 15} className="fill-[#ef4444] text-white" />
            )}
          </span>
          <span className={`leading-relaxed font-medium ${compact ? 'text-xs' : 'text-[13px]'} ${point.type === 'positive' ? 'text-[#065f46]' : 'text-[#991b1b]'}`}>
            {point.text}
          </span>
        </div>
      ))}
    </div>
  );
};

const CategoryCell: React.FC<{ category: CategoryAnalysis }> = ({ category }) => {
  const hasContent = (category?.points?.length ?? 0) > 0;
  return (
    <td className={`p-2 sm:p-3 align-top border-r border-gray-200 ${!hasContent ? 'bg-gray-50/30' : ''}`}>
      <CategoryPoints category={category} />
    </td>
  );
};

export const ComparisonTable: React.FC<Props> = ({ data, title, variant = 'restaurant', rawDatasets, onAnalyze, isAnalyzing, onAnalyzeItem, analyzingItemId }) => {
  const [localFilter, setLocalFilter] = useState<TimeFilter>('1');

  // Memoize review counts and ratings for each row to avoid recalculating on every render
  const rowStats = useMemo(() => {
    const stats = new Map<string, { totalReviews: number; displayRating: number }>();
    data.forEach((row) => {
      stats.set(row.id, {
        totalReviews: getReviewCount(row.id, rawDatasets, localFilter),
        displayRating: getAverageRatingFromRaw(row.id, rawDatasets, localFilter),
      });
    });
    return stats;
  }, [data, rawDatasets, localFilter]);

  let headers = {
    location: "Location",
    totalReviews: "Total review",
    service: "Service",
    food: "Food",
    value: "Value",
    atmosphere: "Atmosphere",
    rating: "Overall Rating"
  };

  if (variant === 'retail') {
    headers = {
      ...headers,
      food: "Products",
      atmosphere: "Store Space"
    };
  } else if (variant === 'supermarket') {
    headers = {
      ...headers,
      food: "Products / Services",
      atmosphere: "Space & Facilities"
    };
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border-2 border-gray-300 overflow-hidden mb-6 sm:mb-10">
      {/* Toolbar */}
      <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 bg-white">
        <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
        <div className="flex flex-col min-[480px]:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <div className="relative flex items-center bg-gray-50 border-2 border-gray-300 rounded-md px-3 py-2.5 sm:py-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all min-h-[44px] sm:min-h-0">
            <Calendar size={16} className="text-gray-400 mr-2 shrink-0" />
            <select
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value as TimeFilter)}
              className="bg-transparent text-sm sm:text-xs font-bold text-gray-700 outline-none pr-6 appearance-none cursor-pointer w-full touch-manipulation"
            >
              {TIME_FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => onAnalyze(localFilter)}
            disabled={isAnalyzing || !!analyzingItemId}
            className={`flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 min-h-[44px] sm:min-h-0 rounded-md text-sm font-bold transition-all whitespace-nowrap touch-manipulation active:scale-[0.98]
              ${isAnalyzing || analyzingItemId
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-inner'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
              }`}
          >
            <RefreshCw size={16} className={isAnalyzing ? 'animate-spin shrink-0' : 'shrink-0'} />
            {isAnalyzing ? 'Analyzing...' : 'Analyze Table'}
          </button>
        </div>
      </div>

      {/* Mobile: card layout */}
      <div className="md:hidden divide-y divide-gray-200">
        {data.map((row) => {
          const stats = rowStats.get(row.id) ?? { totalReviews: 0, displayRating: 0 };
          const { totalReviews, displayRating } = stats;
          return (
          <div key={row.id} className="p-3 relative">
            {(isAnalyzing || analyzingItemId === row.id) && <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] animate-pulse pointer-events-none z-[1] rounded-b-lg" />}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="font-bold text-[15px] text-gray-900 pr-2">{row.location}</h3>
                {row.keyTakeaway?.trim() && (
                  <p className="text-xs text-gray-600 mt-0.5 font-medium">{row.keyTakeaway.trim()}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-600 tabular-nums">{totalReviews} review</span>
                <span className="text-emerald-600 font-black text-lg tabular-nums">{displayRating.toFixed(1)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Link
                to={`/reviews/${row.id}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-md w-full sm:w-auto justify-center min-h-[44px] touch-manipulation"
              >
                <List size={14} />
                View Reviews
              </Link>
              {onAnalyzeItem && (
                <button
                  type="button"
                  onClick={() => onAnalyzeItem(row.id, localFilter)}
                  disabled={isAnalyzing || !!analyzingItemId}
                  className={`flex items-center gap-1.5 text-xs font-semibold min-h-[44px] px-3 py-2 rounded-md touch-manipulation transition-all
                    ${isAnalyzing || analyzingItemId
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                    }`}
                >
                  <RefreshCw size={14} className={analyzingItemId === row.id ? 'animate-spin shrink-0' : 'shrink-0'} />
                  {analyzingItemId === row.id ? 'Analyzing...' : 'Analyze'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{headers.service}</p>
                <CategoryPoints category={row.service} compact />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{headers.food}</p>
                <CategoryPoints category={row.food} compact />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{headers.value}</p>
                <CategoryPoints category={row.value} compact />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{headers.atmosphere}</p>
                <CategoryPoints category={row.atmosphere} compact />
              </div>
            </div>
          </div>
        );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto overflow-y-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full min-w-[900px] lg:min-w-[1100px] border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="p-2 sm:p-3 lg:p-4 text-left text-[11px] lg:text-[12px] font-bold text-gray-500 uppercase tracking-wider w-[16%]">{headers.location}</th>
              <th className="p-2 sm:p-3 lg:p-4 text-right text-[11px] lg:text-[12px] font-bold text-gray-500 uppercase tracking-wider w-[8%]">{headers.totalReviews}</th>
              <th className="p-2 sm:p-3 lg:p-4 text-left text-[11px] lg:text-[12px] font-bold text-gray-500 uppercase tracking-wider w-[19%]">{headers.service}</th>
              <th className="p-2 sm:p-3 lg:p-4 text-left text-[11px] lg:text-[12px] font-bold text-gray-500 uppercase tracking-wider w-[19%]">{headers.food}</th>
              <th className="p-2 sm:p-3 lg:p-4 text-left text-[11px] lg:text-[12px] font-bold text-gray-500 uppercase tracking-wider w-[16%]">{headers.value}</th>
              <th className="p-2 sm:p-3 lg:p-4 text-left text-[11px] lg:text-[12px] font-bold text-gray-500 uppercase tracking-wider w-[16%]">{headers.atmosphere}</th>
              <th className="p-2 sm:p-3 lg:p-4 text-center text-[11px] lg:text-[12px] font-bold text-gray-500 uppercase tracking-wider w-[6%]">{headers.rating}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const stats = rowStats.get(row.id) ?? { totalReviews: 0, displayRating: 0 };
              const { totalReviews, displayRating } = stats;
              return (
              <tr key={row.id} className="border-b border-gray-200 hover:bg-[#fbfcfb] transition-colors group">
                <td className="p-3 lg:p-4 align-top font-bold text-[14px] lg:text-[15px] text-[#111827] relative">
                  {(isAnalyzing || analyzingItemId === row.id) && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] animate-pulse pointer-events-none" />}
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="group-hover:text-emerald-700 transition-colors">{row.location}</span>
                      {row.keyTakeaway?.trim() && (
                        <p className="text-[11px] text-gray-600 mt-0.5 font-medium">{row.keyTakeaway.trim()}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/reviews/${row.id}`}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded-md w-fit transition-colors flex items-center gap-1 min-h-[36px] touch-manipulation"
                      >
                        <List size={12} />
                        View Reviews
                      </Link>
                      {onAnalyzeItem && (
                        <button
                          type="button"
                          onClick={() => onAnalyzeItem(row.id, localFilter)}
                          disabled={isAnalyzing || !!analyzingItemId}
                          className={`text-[11px] font-semibold px-2 py-1.5 rounded-md w-fit transition-colors flex items-center gap-1 min-h-[36px] touch-manipulation
                            ${isAnalyzing || analyzingItemId
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                        >
                          <RefreshCw size={12} className={analyzingItemId === row.id ? 'animate-spin shrink-0' : 'shrink-0'} />
                          {analyzingItemId === row.id ? 'Analyzing...' : 'Analyze'}
                        </button>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 lg:p-4 align-top text-right tabular-nums text-gray-700 font-medium">
                  {totalReviews}
                </td>
                <CategoryCell category={row.service} />
                <CategoryCell category={row.food} />
                <CategoryCell category={row.value} />
                <CategoryCell category={row.atmosphere} />
                <td className="p-3 lg:p-4 align-top text-center">
                  <span className="text-[#10b981] font-black text-lg lg:text-xl tabular-nums">{displayRating.toFixed(1)}</span>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
