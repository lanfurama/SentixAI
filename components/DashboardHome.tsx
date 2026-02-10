import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrainCircuit, UtensilsCrossed, ShoppingBag, Store } from 'lucide-react';

const DASHBOARD_TYPES = [
  { slug: 'dining', label: 'Dining & Venues', description: 'Restaurants and venue analysis', icon: UtensilsCrossed },
  { slug: 'retail', label: 'Retail Stores', description: 'Retail stores performance', icon: ShoppingBag },
  { slug: 'supermarket', label: 'Hypermarkets & Entertainment', description: 'Hypermarkets and entertainment', icon: Store },
] as const;

export const DashboardHome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3 sm:space-y-4">
      <header className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 sm:p-4 rounded-lg border-2 border-slate-300 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-emerald-600 p-2.5 sm:p-3 rounded-lg shadow-lg shadow-emerald-200 shrink-0">
            <BrainCircuit className="text-white w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">Chọn loại hình để xem tổng quan</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-md border-2 border-gray-200 transition-colors self-center sm:self-auto"
        >
          Về trang chủ
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {DASHBOARD_TYPES.map(({ slug, label, description, icon: Icon }) => (
          <Link
            key={slug}
            to={`/dashboard/${slug}`}
            className="block p-3 sm:p-4 bg-white rounded-lg border-2 border-gray-300 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-md shrink-0 group-hover:bg-emerald-100 transition-colors">
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-gray-900 text-base sm:text-lg group-hover:text-emerald-700 transition-colors">{label}</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
