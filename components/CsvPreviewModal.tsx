
import React, { useMemo } from 'react';
import { X, FileText, Check, AlertCircle } from 'lucide-react';
import { parseReviews } from '../utils/csvParser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fileName: string;
  csvContent: string;
  targetItemName?: string;
}

export const CsvPreviewModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, fileName, csvContent, targetItemName }) => {
  if (!isOpen) return null;

  const previewRows = useMemo(() => {
    // Parse the full CSV but only take the first 5 rows for preview
    const allRows = parseReviews(csvContent);
    return allRows.slice(0, 5);
  }, [csvContent]);

  const totalRows = csvContent.trim().split('\n').length - 1; // Approx subtraction for header

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm safe-area-padding">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-2xl border-2 border-gray-300 w-full sm:max-w-3xl flex flex-col max-h-[95vh] sm:max-h-[90vh] duration-200">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-md shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Import CSV Preview</h3>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {targetItemName ? (
                  <>Gộp thêm review mới vào <span className="font-semibold text-gray-700">{targetItemName}</span> • {fileName}</>
                ) : (
                  <>Thêm venue mới • {fileName}</>
                )}
                {' • '}~{totalRows > 0 ? totalRows : 0} records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors touch-manipulation shrink-0"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content: scrollable table or cards on very small */}
        <div className="p-3 sm:p-4 overflow-y-auto overflow-x-auto flex-1 min-h-0 bg-gray-50/50">
          <div className="bg-white border-2 border-gray-300 rounded-md overflow-hidden">
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full min-w-[320px] text-xs sm:text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3">Author</th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap">Rating</th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap">Date</th>
                    <th className="px-3 sm:px-4 py-2.5 sm:py-3 min-w-[120px] sm:min-w-[180px]">Content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewRows.length > 0 ? (
                    previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-gray-900 truncate max-w-[100px] sm:max-w-[150px]">{row.author}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-emerald-600 font-bold whitespace-nowrap">{row.rating} ★</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-gray-500 whitespace-nowrap">{row.date}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-gray-600 line-clamp-2 sm:truncate max-w-[140px] sm:max-w-[300px]" title={row.content || undefined}>
                          {row.content || <span className="italic text-gray-300">No content</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={24} />
                          <span className="text-sm">No valid data found or empty CSV.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalRows > 5 && (
              <div className="px-3 sm:px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-center text-gray-500 italic">
                ...and {totalRows - 5} more rows
              </div>
            )}
          </div>
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs sm:text-sm rounded-md border-2 border-blue-200 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{targetItemName ? 'Dữ liệu cũ được giữ nguyên. Chỉ thêm các review mới (trùng lặp sẽ bỏ qua). ' : ''}Hỗ trợ: <strong>author/commented_at/content/rating</strong> hoặc <strong>Reviewer/Time/Comment/Rating</strong>.</p>
          </div>
        </div>

        {/* Footer: stack on mobile */}
        <div className="p-3 sm:p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-white rounded-b-lg shrink-0 safe-area-padding">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 min-h-[44px] text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-md transition-colors touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={previewRows.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-2 min-h-[44px] text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          >
            <Check size={16} />
            Confirm Import
          </button>
        </div>
      </div>
    </div>
  );
};
