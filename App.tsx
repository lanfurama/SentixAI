import React, { Suspense, useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { ReviewList } from './components/ReviewList';
import { DashboardHome } from './components/DashboardHome';
import { TypeDashboard } from './components/TypeDashboard';
import { RawReviewData } from './types';
import { fetchDataset } from './services/api';
import { HomePage } from './pages/HomePage';
import { useComparisonData } from './hooks/useComparisonData';

const DiningPage = React.lazy(() => import('./pages/DiningPage').then(module => ({ default: module.DiningPage })));
const RetailPage = React.lazy(() => import('./pages/RetailPage').then(module => ({ default: module.RetailPage })));
const SupermarketPage = React.lazy(() => import('./pages/SupermarketPage').then(module => ({ default: module.SupermarketPage })));

const App: React.FC = () => {
  const { loading, error, apiReady } = useComparisonData();

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
            element={<HomePage error={error} apiReady={apiReady} />}
          />
          <Route
            path="/dining"
            element={
              <Suspense fallback={
                <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 safe-area-padding">
                  <div className="text-slate-500 font-medium text-sm sm:text-base">Loading...</div>
                </div>
              }>
                <DiningPage />
              </Suspense>
            }
          />
          <Route
            path="/retail"
            element={
              <Suspense fallback={
                <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 safe-area-padding">
                  <div className="text-slate-500 font-medium text-sm sm:text-base">Loading...</div>
                </div>
              }>
                <RetailPage />
              </Suspense>
            }
          />
          <Route
            path="/supermarket"
            element={
              <Suspense fallback={
                <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 safe-area-padding">
                  <div className="text-slate-500 font-medium text-sm sm:text-base">Loading...</div>
                </div>
              }>
                <SupermarketPage />
              </Suspense>
            }
          />
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/:type" element={<TypeDashboard />} />
          <Route path="/reviews/:resortId" element={<ReviewsPage />} />
        </Routes>
      </div>
    </div>
  );
};


function ReviewsPage() {
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
  return <ReviewList reviewData={reviewData} onBack={() => navigate('/')} />;
}

export default App;
