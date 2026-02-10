import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchDatasets, fetchComparison } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ComparisonRow, RawReviewData, TimeFilter, CategoryAnalysis } from '../types';
import { RETAIL_STORE_IDS, SUPERMARKET_IDS, TIME_FILTER_OPTIONS } from '../constants';
import { filterCsvByTime, filterCsvByTimeRange, filterCsvByDaysRange } from '../utils/csvFilter';
import { parseReviews } from '../utils/csvParser';
import { ArrowLeft, Calendar, List, Star, TrendingUp, TrendingDown, MapPin, MessageSquare, BarChart3 } from 'lucide-react';

function getReviewCount(
  datasetId: string,
  rawDatasets: RawReviewData[],
  timeFilter: TimeFilter
): number {
  const ds = rawDatasets.find((d) => d.id === datasetId);
  if (!ds?.csvContent) return 0;
  const months = timeFilter === 'all' ? 'all' : parseFloat(timeFilter);
  const filtered = filterCsvByTime(ds.csvContent, months);
  const reviews = parseReviews(filtered);
  return reviews.length;
}

/** Review count for a time range: [startMonthsAgo, endMonthsAgo). E.g. (2,1) = previous month. */
function getReviewCountForPeriod(
  datasetId: string,
  rawDatasets: RawReviewData[],
  startMonthsAgo: number,
  endMonthsAgo: number
): number {
  const ds = rawDatasets.find((d) => d.id === datasetId);
  if (!ds?.csvContent || startMonthsAgo <= endMonthsAgo) return 0;
  const filtered = filterCsvByTimeRange(ds.csvContent, startMonthsAgo, endMonthsAgo);
  const reviews = parseReviews(filtered);
  return reviews.length;
}

/** Review count for day range: [startDaysAgo, endDaysAgo). E.g. (7,0) = last 7 days, (14,7) = previous week. */
function getReviewCountForDaysRange(
  datasetId: string,
  rawDatasets: RawReviewData[],
  startDaysAgo: number,
  endDaysAgo: number
): number {
  const ds = rawDatasets.find((d) => d.id === datasetId);
  if (!ds?.csvContent || startDaysAgo <= endDaysAgo) return 0;
  const filtered = filterCsvByDaysRange(ds.csvContent, startDaysAgo, endDaysAgo);
  const reviews = parseReviews(filtered);
  return reviews.length;
}

/** Average rating from raw reviews in the period (when no AI overallRating). Returns 0 if no reviews. */
function getAverageRatingFromRaw(
  datasetId: string,
  rawDatasets: RawReviewData[],
  timeFilter: TimeFilter
): number {
  const ds = rawDatasets.find((d) => d.id === datasetId);
  if (!ds?.csvContent) return 0;
  const months = timeFilter === 'all' ? 'all' : parseFloat(timeFilter);
  const filtered = filterCsvByTime(ds.csvContent, months);
  const reviews = parseReviews(filtered);
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((s, r) => s + (typeof r.rating === 'number' ? r.rating : 0), 0);
  return sum / reviews.length;
}

/** Rating to display: from AI analysis if available, else average from raw reviews in period. */
function getEffectiveRating(
  row: ComparisonRow,
  rawDatasets: RawReviewData[],
  timeFilter: TimeFilter
): number {
  return row.overallRating > 0 ? row.overallRating : getAverageRatingFromRaw(row.id, rawDatasets, timeFilter);
}

function getCategoryDisplayText(category: CategoryAnalysis): string {
  if (category?.summary?.trim()) return category.summary.trim();
  const points = category?.points ?? [];
  if (points.length > 0) return points[0].text;
  return '—';
}

const TYPE_META = {
  dining: {
    title: 'Dining & Venues',
    headers: { service: 'Service', food: 'Food', value: 'Value', atmosphere: 'Atmosphere' },
  },
  retail: {
    title: 'Retail Stores Performance',
    headers: { service: 'Service', food: 'Products', value: 'Value', atmosphere: 'Store Space' },
  },
  supermarket: {
    title: 'Hypermarkets & Entertainment',
    headers: { service: 'Service', food: 'Products / Services', value: 'Value', atmosphere: 'Space & Facilities' },
  },
} as const;

type DashboardType = keyof typeof TYPE_META;

function filterDataByType(data: ComparisonRow[], type: string): ComparisonRow[] {
  const isRetail = (id: string) => (RETAIL_STORE_IDS as readonly string[]).includes(id);
  const isSupermarket = (id: string) => (SUPERMARKET_IDS as readonly string[]).includes(id);
  if (type === 'dining') return data.filter((r) => !isRetail(r.id) && !isSupermarket(r.id));
  if (type === 'retail') return data.filter((r) => isRetail(r.id));
  if (type === 'supermarket') return data.filter((r) => isSupermarket(r.id));
  return [];
}

/** Current period (months) and previous period (start, end) for comparison. */
function getPeriodBounds(timeFilter: TimeFilter): { current: number; prevStart: number; prevEnd: number } | null {
  if (timeFilter === 'all') return null;
  const n = parseFloat(timeFilter);
  return { current: n, prevStart: n * 2, prevEnd: n };
}

export type ComparisonMode = 'month' | 'week';

export const TypeDashboard: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [rawDatasets, setRawDatasets] = useState<RawReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('1');
  const [showDetailTable, setShowDetailTable] = useState(false);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('month');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [datasets, comparison] = await Promise.all([fetchDatasets(), fetchComparison()]);
        if (!cancelled) {
          setRawDatasets(datasets);
          setData(comparison);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Không tải được dữ liệu. Kiểm tra server (npm run server).');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const meta = type && type in TYPE_META ? TYPE_META[type as DashboardType] : null;
  const rows = useMemo(
    () => (type ? filterDataByType(data, type) : []),
    [data, type]
  );

  const periodBounds = getPeriodBounds(timeFilter);

  const kpis = useMemo(() => {
    const totalReviews = rows.reduce((sum, r) => sum + getReviewCount(r.id, rawDatasets, timeFilter), 0);
    const effectiveRatings = rows.map((r) =>
      r.overallRating > 0 ? r.overallRating : getAverageRatingFromRaw(r.id, rawDatasets, timeFilter)
    );
    const rowsWithRating = effectiveRatings.filter((v) => v > 0);
    const avgRating: number | null =
      rowsWithRating.length > 0
        ? rowsWithRating.reduce((s, v) => s + v, 0) / rowsWithRating.length
        : null;
    let prevTotal = 0;
    let periodChange: number | null = null;
    if (comparisonMode === 'week') {
      const thisWeek = rows.reduce((sum, r) => sum + getReviewCountForDaysRange(r.id, rawDatasets, 7, 0), 0);
      prevTotal = rows.reduce((sum, r) => sum + getReviewCountForDaysRange(r.id, rawDatasets, 14, 7), 0);
      periodChange = prevTotal > 0 ? ((thisWeek - prevTotal) / prevTotal) * 100 : (thisWeek > 0 ? 100 : 0);
    } else if (periodBounds) {
      prevTotal = rows.reduce(
        (sum, r) => sum + getReviewCountForPeriod(r.id, rawDatasets, periodBounds.prevStart, periodBounds.prevEnd),
        0
      );
      periodChange = prevTotal > 0 ? ((totalReviews - prevTotal) / prevTotal) * 100 : (totalReviews > 0 ? 100 : 0);
    }
    return { totalReviews, avgRating, prevTotal, periodChange };
  }, [rows, rawDatasets, timeFilter, periodBounds, comparisonMode]);

  const chartRatingData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.location.length > 28 ? r.location.slice(0, 26) + '…' : r.location,
        fullName: r.location,
        rating: getEffectiveRating(r, rawDatasets, timeFilter),
      })),
    [rows, rawDatasets, timeFilter]
  );

  const chartReviewData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.location.length > 28 ? r.location.slice(0, 26) + '…' : r.location,
        fullName: r.location,
        reviews: getReviewCount(r.id, rawDatasets, timeFilter),
      })),
    [rows, rawDatasets, timeFilter]
  );

  const comparisonData = useMemo(() => {
    if (comparisonMode === 'week') {
      return rows.map((r) => ({
        name: r.location.length > 22 ? r.location.slice(0, 20) + '…' : r.location,
        fullName: r.location,
        kìTrước: getReviewCountForDaysRange(r.id, rawDatasets, 14, 7),
        kìNày: getReviewCountForDaysRange(r.id, rawDatasets, 7, 0),
      }));
    }
    if (!periodBounds) return [];
    return rows.map((r) => ({
      name: r.location.length > 22 ? r.location.slice(0, 20) + '…' : r.location,
      fullName: r.location,
      kìTrước: getReviewCountForPeriod(r.id, rawDatasets, periodBounds.prevStart, periodBounds.prevEnd),
      kìNày: getReviewCount(r.id, rawDatasets, timeFilter),
    }));
  }, [rows, rawDatasets, timeFilter, periodBounds, comparisonMode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500 font-medium text-sm">Đang tải dữ liệu từ API...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-rose-600 font-medium text-sm text-center">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-emerald-600 hover:text-emerald-700 font-semibold text-sm"
        >
          Về Dashboard
        </button>
      </div>
    );
  }

  if (!type || !meta) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-rose-600 font-medium text-sm">Dashboard type not found.</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-3 text-emerald-600 hover:text-emerald-700 font-semibold text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { title, headers } = meta;
  const periodLabel = timeFilter === 'all' ? 'Toàn thời gian' : TIME_FILTER_OPTIONS.find((o) => o.value === timeFilter)?.label ?? timeFilter;

  return (
    <div className="space-y-3 sm:space-y-4">
      <header className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-lg border-2 border-slate-300 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-md border-2 border-gray-200 transition-colors text-gray-500 hover:text-gray-900 shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">Trực quan hóa & so sánh cùng kì · Kì: {periodLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border-2 border-gray-300 p-0.5 bg-gray-50" role="group">
            <button
              type="button"
              onClick={() => setComparisonMode('month')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${comparisonMode === 'month' ? 'bg-white text-emerald-700 shadow border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Cùng kì tháng
            </button>
            <button
              type="button"
              onClick={() => setComparisonMode('week')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${comparisonMode === 'week' ? 'bg-white text-emerald-700 shadow border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Cùng kì tuần
            </button>
          </div>
          <div className="relative flex items-center bg-gray-50 border-2 border-gray-300 rounded-md px-3 py-2 min-h-[44px] sm:min-h-0 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
            <Calendar size={16} className="text-gray-400 mr-2 shrink-0" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="bg-transparent text-sm font-bold text-gray-700 outline-none pr-6 appearance-none cursor-pointer w-full"
            >
              {TIME_FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-white p-3 rounded-lg border-2 border-gray-300 flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-md">
            <MapPin size={18} className="text-slate-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Địa điểm</p>
            <p className="text-lg font-black text-slate-900 tabular-nums">{rows.length}</p>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border-2 border-gray-300 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-md">
            <MessageSquare size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tổng review (kì)</p>
            <p className="text-lg font-black text-slate-900 tabular-nums">{kpis.totalReviews}</p>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border-2 border-gray-300 flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-md">
            <Star size={18} className="text-amber-600 fill-amber-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rating TB</p>
            <p className="text-lg font-black text-slate-900 tabular-nums">{kpis.avgRating !== null ? kpis.avgRating.toFixed(1) : '—'}</p>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border-2 border-gray-300 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <BarChart3 size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{comparisonMode === 'week' ? 'So với tuần trước' : 'So với kì trước'}</p>
            {kpis.periodChange !== null ? (
              <p className={`text-lg font-black tabular-nums flex items-center gap-1 ${kpis.periodChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {kpis.periodChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {kpis.periodChange >= 0 ? '+' : ''}{kpis.periodChange.toFixed(0)}%
              </p>
            ) : (
              <p className="text-sm text-gray-500">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg border-2 border-gray-300 p-3 overflow-hidden">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Rating theo địa điểm</h3>
          <div className="h-[240px] min-w-0">
            {chartRatingData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={chartRatingData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip content={<TooltipContent fullNameKey="fullName" valueLabel="Rating" />} />
                  <Bar dataKey="rating" fill="#059669" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa có dữ liệu</div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg border-2 border-gray-300 p-3 overflow-hidden">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Số review theo địa điểm (kì)</h3>
          <div className="h-[240px] min-w-0">
            {chartReviewData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={chartReviewData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip content={<TooltipContent fullNameKey="fullName" valueLabel="Reviews" valueKey="reviews" />} />
                  <Bar dataKey="reviews" fill="#0ea5e9" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa có dữ liệu</div>
            )}
          </div>
        </div>
      </div>

      {/* So sánh cùng kì (tháng hoặc tuần) */}
      {comparisonData.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider p-3 border-b border-gray-200">
            So sánh cùng kì: {comparisonMode === 'week' ? 'Tuần trước vs Tuần này' : 'Kì trước vs Kì này'} (số review)
          </h3>
          <div className="p-3 overflow-x-auto">
            <div className="h-[280px] min-w-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparisonData}
                  margin={{ top: 0, right: 8, left: 0, bottom: 60 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={56} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const prevLabel = comparisonMode === 'week' ? 'Tuần trước' : 'Kì trước';
                      const currLabel = comparisonMode === 'week' ? 'Tuần này' : 'Kì này';
                      return (
                        <div className="bg-white border-2 border-gray-200 rounded-md shadow-lg p-2 text-xs">
                          <p className="font-bold text-gray-900 border-b border-gray-100 pb-1 mb-1">{d.fullName}</p>
                          <p>{prevLabel}: <strong>{d.kìTrước}</strong> review</p>
                          <p>{currLabel}: <strong>{d.kìNày}</strong> review</p>
                          {d.kìTrước > 0 && (
                            <p className={d.kìNày >= d.kìTrước ? 'text-emerald-600' : 'text-rose-600'}>
                              {d.kìNày >= d.kìTrước ? '+' : ''}{(((d.kìNày - d.kìTrước) / d.kìTrước) * 100).toFixed(0)}%
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="kìTrước" name={comparisonMode === 'week' ? 'Tuần trước' : 'Kì trước'} fill="#94a3b8" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="kìNày" name={comparisonMode === 'week' ? 'Tuần này' : 'Kì này'} fill="#059669" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 px-3 pb-3 text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400" /> {comparisonMode === 'week' ? 'Tuần trước' : 'Kì trước'}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> {comparisonMode === 'week' ? 'Tuần này' : 'Kì này'}</span>
          </div>
        </div>
      )}

      {/* Bảng chi tiết (toggle) */}
      <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDetailTable((v) => !v)}
          className="w-full p-3 flex items-center justify-between text-left border-b border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-bold text-gray-700">Bảng chi tiết từng địa điểm</span>
          <span className="text-xs text-gray-500">{showDetailTable ? 'Thu gọn' : 'Mở rộng'}</span>
        </button>
        {showDetailTable && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-2 sm:p-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="p-2 sm:p-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total reviews</th>
                    <th className="p-2 sm:p-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="p-2 sm:p-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{headers.service}</th>
                    <th className="p-2 sm:p-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{headers.food}</th>
                    <th className="p-2 sm:p-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{headers.value}</th>
                    <th className="p-2 sm:p-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{headers.atmosphere}</th>
                    <th className="p-2 sm:p-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const totalReviews = getReviewCount(row.id, rawDatasets, timeFilter);
                    return (
                      <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50/50">
                        <td className="p-2 sm:p-3 font-bold text-[14px] text-gray-900">{row.location}</td>
                        <td className="p-2 sm:p-3 text-right tabular-nums text-gray-700">{totalReviews}</td>
                        <td className="p-2 sm:p-3 text-center">
                          <span className="text-emerald-600 font-black tabular-nums">{getEffectiveRating(row, rawDatasets, timeFilter).toFixed(1)}</span>
                          <Star size={12} className="inline-block ml-0.5 text-emerald-500 fill-current" />
                        </td>
                        <td className="p-2 sm:p-3 max-w-[180px]"><CategorySummaryText text={getCategoryDisplayText(row.service)} /></td>
                        <td className="p-2 sm:p-3 max-w-[180px]"><CategorySummaryText text={getCategoryDisplayText(row.food)} /></td>
                        <td className="p-2 sm:p-3 max-w-[180px]"><CategorySummaryText text={getCategoryDisplayText(row.value)} /></td>
                        <td className="p-2 sm:p-3 max-w-[180px]"><CategorySummaryText text={getCategoryDisplayText(row.atmosphere)} /></td>
                        <td className="p-2 sm:p-3">
                          <Link to={`/reviews/${row.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded-md">
                            <List size={12} /> Chi tiết
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-gray-200">
              {rows.map((row) => {
                const totalReviews = getReviewCount(row.id, rawDatasets, timeFilter);
                return (
                  <div key={row.id} className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-sm flex-1 truncate">{row.location}</h3>
                      <span className="text-emerald-600 font-black tabular-nums">{getEffectiveRating(row, rawDatasets, timeFilter).toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{totalReviews} reviews</p>
                    <div className="space-y-1 text-xs mb-2">
                      <div><span className="text-gray-500 font-semibold">{headers.service}:</span> <CategorySummaryText text={getCategoryDisplayText(row.service)} /></div>
                      <div><span className="text-gray-500 font-semibold">{headers.food}:</span> <CategorySummaryText text={getCategoryDisplayText(row.food)} /></div>
                      <div><span className="text-gray-500 font-semibold">{headers.value}:</span> <CategorySummaryText text={getCategoryDisplayText(row.value)} /></div>
                      <div><span className="text-gray-500 font-semibold">{headers.atmosphere}:</span> <CategorySummaryText text={getCategoryDisplayText(row.atmosphere)} /></div>
                    </div>
                    <Link to={`/reviews/${row.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-md w-full justify-center">
                      <List size={14} /> Xem reviews
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {rows.length === 0 && (
        <div className="bg-white rounded-lg border-2 border-gray-300 p-8 text-center text-gray-500 text-sm">
          Chưa có dữ liệu cho loại hình này.
        </div>
      )}
    </div>
  );
};

function TooltipContent({
  active,
  payload,
  fullNameKey,
  valueLabel,
  valueKey = 'rating',
}: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  fullNameKey: string;
  valueLabel: string;
  valueKey?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const name = (p[fullNameKey] as string) ?? '';
  const value = (p[valueKey] as number) ?? 0;
  return (
    <div className="bg-white border-2 border-gray-200 rounded-md shadow-lg px-2 py-1.5 text-xs">
      <p className="font-bold text-gray-900 truncate max-w-[200px]">{name}</p>
      <p className="text-gray-600">{valueLabel}: <strong>{value}</strong></p>
    </div>
  );
}

function CategorySummaryText({ text }: { text: string }) {
  if (text === '—') return <span className="text-gray-400 text-xs">—</span>;
  return <p className="text-gray-700 text-xs leading-snug line-clamp-3" title={text}>{text}</p>;
}
