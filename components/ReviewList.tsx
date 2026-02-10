
import React, { useMemo, useState } from 'react';
import { RawReviewData, TimeFilter } from '../types';
import { SAMPLE_DATA_ANCHOR_DATE, TIME_FILTER_OPTIONS } from '../constants';
import { parseReviews } from '../utils/csvParser';
import { parseDate } from '../utils/csvFilter';
import { ArrowLeft, Star, Calendar, MessageSquare, Upload } from 'lucide-react';

interface Props {
  reviewData: RawReviewData;
  onBack: () => void;
  onImportCsv: () => void;
}

export const ReviewList: React.FC<Props> = ({ reviewData, onBack, onImportCsv }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Parse, Filter, Sort (newest first)
  const reviews = useMemo(() => {
    const allReviews = parseReviews(reviewData.csvContent);

    let filtered = allReviews;
    if (timeFilter !== 'all') {
      const now = new Date(SAMPLE_DATA_ANCHOR_DATE);
      const months = parseFloat(timeFilter);
      const DAYS_PER_MONTH = 31;
      const cutoff = new Date(now.getTime() - months * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);
      filtered = allReviews.filter(r => parseDate(r.date) >= cutoff);
    }

    return [...filtered].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
  }, [reviewData.csvContent, timeFilter]);

  const ratingCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        counts[r.rating as keyof typeof counts]++;
      }
    });
    return counts;
  }, [reviews]);

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="bg-white rounded-lg shadow-sm border-2 border-gray-300 overflow-hidden min-h-[50vh] sm:min-h-[600px] flex flex-col">
      {/* Header: sticky, touch-friendly */}
      <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-white sticky top-0 z-10 shadow-sm gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onBack}
            className="p-2.5 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 touch-manipulation shrink-0"
          >
            <ArrowLeft size={22} className="sm:w-5 sm:h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate sm:whitespace-normal">{reviewData.name}</h2>
            <div className="text-xs sm:text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="font-medium text-gray-700">{reviews.length} reviews</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-xs">
                {averageRating} <Star size={10} fill="currentColor" />
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onImportCsv}
            className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs sm:text-sm font-bold transition-all active:scale-[0.98] touch-manipulation shrink-0"
          >
            <Upload size={16} />
            Import CSV
          </button>
          <div className="relative flex items-center bg-gray-50 border-2 border-gray-300 rounded-md px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 hover:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all shrink-0 w-full sm:w-auto">
            <Calendar size={18} className="text-gray-400 mr-2 sm:w-4 sm:h-4 shrink-0" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="bg-transparent text-sm font-semibold text-gray-700 outline-none pr-8 appearance-none cursor-pointer w-full touch-manipulation"
            >
              {TIME_FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-full grow min-h-0">
        {/* Sidebar: full width on mobile, fixed width on desktop */}
        <div className="w-full md:w-72 p-3 sm:p-4 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 shrink-0">
          <h3 className="font-bold text-gray-800 mb-4 sm:mb-6 text-xs sm:text-sm uppercase tracking-wide">Rating Distribution</h3>
          <div className="space-y-2.5 sm:space-y-3">
            {[5, 4, 3, 2, 1].map(star => {
              const count = ratingCounts[star as keyof typeof ratingCounts] || 0;
              const percent = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div className="flex items-center gap-1 w-7 sm:w-8 shrink-0">
                    <span className="font-semibold text-gray-700">{star}</span>
                    <Star size={12} className="text-gray-400" />
                  </div>
                  <div className="flex-1 h-2 sm:h-2.5 bg-gray-200 rounded-full overflow-hidden min-w-0">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-6 sm:w-8 text-right text-gray-500 text-xs font-medium tabular-nums shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-blue-50 border-2 border-blue-200 rounded-md">
            <p className="text-xs text-blue-700 leading-relaxed">
              Showing <strong>{reviews.length}</strong> reviews for the selected period.
            </p>
          </div>
        </div>

        {/* Review list: scrollable */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-white max-h-[calc(100vh-16rem)] sm:max-h-[calc(100vh-200px)] min-h-0">
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {reviews.map((review, idx) => (
              <div key={idx} className="p-3 sm:p-4 rounded-lg border-2 border-gray-200 hover:border-emerald-200 hover:shadow-md transition-all bg-white">
                <div className="flex justify-between items-start gap-2 mb-2 sm:mb-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center text-gray-600 text-[10px] sm:text-xs font-bold uppercase shadow-sm shrink-0">
                      {review.author.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1">{review.author}</div>
                      <div className="text-[11px] sm:text-xs text-gray-400 font-medium">{review.date}</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${review.rating >= 4 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : review.rating === 3 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                    <span>{review.rating}.0</span>
                    <Star size={10} fill="currentColor" />
                  </div>
                </div>
                {review.content ? (
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line pl-0 sm:pl-10 mt-1 sm:mt-0">
                    {review.content}
                  </p>
                ) : (
                  <p className="text-gray-400 text-xs italic pl-0 sm:pl-10 mt-1 sm:mt-0 opacity-60">No comment content.</p>
                )}
                <div className="mt-3 sm:mt-4 pl-0 sm:pl-10 flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold bg-gray-50 px-2 py-1 rounded-md border-2 border-gray-200">
                    {review.source}
                  </span>
                </div>
              </div>
            ))}

            {reviews.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-gray-400 px-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                  <MessageSquare size={22} className="sm:w-6 sm:h-6 opacity-30" />
                </div>
                <p className="text-base sm:text-lg font-medium text-gray-500 text-center">No reviews found</p>
                <p className="text-xs sm:text-sm text-center mt-1">Try adjusting the time filter to see more results.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
