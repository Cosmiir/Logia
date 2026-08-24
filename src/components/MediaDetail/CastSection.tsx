import React, { useRef, useState, useEffect, useCallback } from 'react';
import i18next from 'i18next';
import { PersonPhoto } from '@/components/PersonPhoto';
import SectionHeader from './SectionHeader';
import type { MediaCredit } from '@/types';

interface CastSectionProps {
  credits?: MediaCredit[];
  onPersonClick: (personId: number) => void;
  className?: string;
  bare?: boolean;
}

const CastCard: React.FC<{ credit: MediaCredit; onPersonClick: (id: number) => void }> = ({ credit, onPersonClick }) => (
  <button
    type="button"
    onClick={() => onPersonClick(credit.person_id)}
    className="flex flex-col items-center gap-2 w-[72px] shrink-0 group text-left cursor-pointer"
  >
    <div className="transition-transform duration-300 group-hover:scale-105 w-full flex justify-center">
      <PersonPhoto name={credit.name} photoPath={credit.photo_path} widthClass="w-full" textSize="text-base" />
    </div>
    <div className="text-center w-full">
      <p
        className="text-xs font-bold text-white text-center line-clamp-2 leading-tight"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 8px rgba(0,0,0,0.6)' }}
        title={credit.name}
      >
        {credit.name}
      </p>
      {credit.role && (
        <p
          className="text-[10px] text-white/60 text-center line-clamp-2 leading-tight mt-0.5"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
          title={credit.role}
        >
          {credit.role}
        </p>
      )}
    </div>
  </button>
);

const DraggableCast: React.FC<{ credits: MediaCredit[]; onPersonClick: (id: number) => void }> = ({ credits, onPersonClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  // Drag state refs
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollRef = useRef(0);
  const dragMovedRef = useRef(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 2;
    setHasOverflow(overflow);
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    const t = setTimeout(updateScrollState, 300);
    const t2 = setTimeout(updateScrollState, 1000);
    window.addEventListener('resize', updateScrollState);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, credits]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollState]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !hasOverflow) return;
    isDownRef.current = true;
    dragMovedRef.current = false;
    startXRef.current = e.pageX;
    startScrollRef.current = el.scrollLeft;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !isDownRef.current) return;
    const dx = e.pageX - startXRef.current;
    if (Math.abs(dx) > 4) dragMovedRef.current = true;
    el.scrollLeft = startScrollRef.current - dx;
  };

  const stopDrag = () => {
    isDownRef.current = false;
    setIsDragging(false);
  };

  // Prevent click after a drag (so releasing after scrolling doesn't navigate to a person)
  const handleClickCapture = (e: React.MouseEvent) => {
    if (dragMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      dragMovedRef.current = false;
    }
  };

  // Soft edge fade, only shown on the side(s) that actually have hidden content.
  // This avoids the first/last card looking cropped when there's nothing left to scroll to.
  const edgeMask = !hasOverflow
    ? 'none'
    : `linear-gradient(to right, ${atStart ? 'black 0%' : 'transparent 0%, black 8%'}, ${
        atEnd ? 'black 100%' : 'black 92%, transparent 100%'
      })`;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onScroll={updateScrollState}
        onClickCapture={handleClickCapture}
        className="flex gap-4 overflow-x-auto pb-2 carousel-scrollbar select-none"
        style={{
          scrollbarWidth: 'none',
          minWidth: 0,
          cursor: hasOverflow ? (isDragging ? 'grabbing' : 'grab') : 'default',
          WebkitMaskImage: edgeMask,
          maskImage: edgeMask,
        }}
      >
        {credits.map((credit, i) => (
          <CastCard key={i} credit={credit} onPersonClick={onPersonClick} />
        ))}
      </div>
    </div>
  );
};

const CastSection: React.FC<CastSectionProps> = ({
  credits = [],
  onPersonClick,
  className = '',
  bare = false,
}) => {
  const hasCredits = credits.length > 0;

  if (!hasCredits) return null;

  const wrapperClass = bare
    ? `flex flex-col ${className}`
    : `glass-card rounded-2xl p-5 h-full flex flex-col ${className}`;

  return (
    <div className={wrapperClass}>
      {/* ── Casting ── */}
      <div className="flex flex-col h-full">
        {bare ? (
          <p
            className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
          >
            {i18next.t('mediaDetail.mainCast')}
          </p>
        ) : (
          <SectionHeader title={i18next.t('mediaDetail.mainCast')} />
        )}
        <div className="pt-1 flex-1">
          <DraggableCast credits={credits} onPersonClick={onPersonClick} />
        </div>
      </div>
    </div>
  );
};

export default CastSection;