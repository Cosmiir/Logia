import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageStart: number;
  pageEnd: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageStart,
  pageEnd,
  onPageChange,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setInputValue(String(currentPage));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, currentPage]);

  if (totalPages <= 1) return null;

  const commit = () => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      onPageChange(Math.max(1, Math.min(totalPages, parsed)));
    }
    setIsEditing(false);
  };

  const btnBase =
    'flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-medium transition-all duration-150';
  const btnActive =
    'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white cursor-pointer';
  const btnDisabled =
    'bg-white/[0.02] border-white/5 text-white/15 cursor-not-allowed';

  return (
    <div className="flex items-center justify-between gap-4 mt-4 pt-2">
      {/* Info */}
      <span className="text-xs text-white/30 tabular-nums">
        <span className="text-white/60 font-medium">{pageStart}–{pageEnd}</span>
        {' '}sur{' '}
        <span className="text-white/60 font-medium">{totalItems}</span>
      </span>

      {/* Controls */}
      <div className="flex items-center gap-1">

        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnActive}`}
          title={t('pagination.first')}
        >
          <ChevronFirst className="w-3.5 h-3.5" />
        </button>

        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnActive}`}
          title={t('pagination.previous')}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page indicator — click to edit */}
        <div className="mx-1">
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={totalPages}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-14 h-8 text-center text-sm font-semibold text-white bg-white/5 border border-primary/40 rounded-lg focus:outline-none focus:border-primary/70 transition-colors tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="h-8 px-3 rounded-lg border border-primary/40 bg-primary/10 text-white text-sm font-semibold tabular-nums hover:bg-primary/20 transition-colors cursor-pointer min-w-[48px]"
              title={t('pagination.goToPage')}
            >
              {currentPage}
              <span className="text-white/25 font-normal ml-1 text-xs">/ {totalPages}</span>
            </button>
          )}
        </div>

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnActive}`}
          title={t('pagination.next')}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`${btnBase} ${currentPage === totalPages ? btnDisabled : btnActive}`}
          title={t('pagination.last')}
        >
          <ChevronLast className="w-3.5 h-3.5" />
        </button>

      </div>
    </div>
  );
};
