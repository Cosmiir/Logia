import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import i18next from 'i18next';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';

interface MediaCarouselProps {
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = ({ children, className = '', isLoading = false }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [cardWidth, setCardWidth] = useState(180);
  const [visibleCards, setVisibleCards] = useState(4);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimatingRef = useRef(false);
  const animationsEnabled = useProfileSettingsStore((s) => s.personalization.animationsEnabled);
  // Ref so the scroll/animation callbacks always see the latest value (avoids stale closures)
  const animationsEnabledRef = useRef(animationsEnabled);
  useEffect(() => { animationsEnabledRef.current = animationsEnabled; }, [animationsEnabled]);

  const GAP = 16;
  const MIN_CARD_WIDTH = 180;

  const calculateLayout = (containerWidth: number) => {
    const maxVisible = Math.floor((containerWidth + GAP) / (MIN_CARD_WIDTH + GAP));
    const actualVisible = Math.max(1, maxVisible);
    const totalGap = GAP * (actualVisible - 1);
    const cardW = Math.floor((containerWidth - totalGap) / actualVisible);
    return { visibleCards: actualVisible, cardWidth: Math.max(MIN_CARD_WIDTH, cardW) };
  };

  // Full state refresh — used on mount, resize, and after scroll settles
  const refreshState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const hasOverflow = scrollWidth > clientWidth;
    const { visibleCards: visCards, cardWidth: cWidth } = calculateLayout(clientWidth);

    setVisibleCards(visCards);
    setCardWidth(cWidth);
    setShowControls(hasOverflow);
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);

    if (hasOverflow) {
      const totalCards = React.Children.count(children);
      const pages = Math.ceil(totalCards / visCards);
      setTotalPages(pages);

      const maxScroll = scrollWidth - clientWidth;
      const pageStep = (cWidth + GAP) * visCards;
      const page = scrollLeft >= maxScroll - 5
        ? pages - 1
        : Math.round(scrollLeft / pageStep);
      setCurrentPage(Math.min(page, pages - 1));
    } else {
      setTotalPages(0);
      setCurrentPage(0);
    }
  }, [children]);

  useEffect(() => {
    refreshState();
    window.addEventListener('resize', refreshState);
    return () => window.removeEventListener('resize', refreshState);
  }, [refreshState]);

  // Custom RAF-based smooth scroll — works regardless of CSS scroll-behavior
  const animateScroll = useCallback((targetScroll: number, duration = 380) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const startScroll = container.scrollLeft;
    const distance = targetScroll - startScroll;
    if (Math.abs(distance) < 1) return;

    const startTime = performance.now();
    isAnimatingRef.current = true;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      container.scrollLeft = startScroll + distance * easeInOutCubic(progress);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        container.scrollLeft = targetScroll;
        isAnimatingRef.current = false;
        refreshState();
      }
    };

    requestAnimationFrame(step);
  }, [refreshState]);

  const scrollTo = useCallback((targetScroll: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const clamped = Math.max(0, Math.min(targetScroll, container.scrollWidth - container.clientWidth));

    if (animationsEnabledRef.current) {
      animateScroll(clamped);
    } else {
      container.scrollLeft = clamped;
      refreshState();
    }
  }, [animateScroll, refreshState]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container || cardWidth === 0 || visibleCards === 0) return;
    if (isAnimatingRef.current) return;

    const pageStep = (cardWidth + GAP) * visibleCards;
    const target = direction === 'left'
      ? container.scrollLeft - pageStep
      : container.scrollLeft + pageStep;
    scrollTo(target);
  };

  const scrollToPage = (index: number) => {
    if (isAnimatingRef.current) return;
    const pageStep = (cardWidth + GAP) * visibleCards;
    scrollTo(index * pageStep);
  };

  // During native touch/trackpad scroll: only update arrows live; refresh page indicator after settling
  const handleScroll = useCallback(() => {
    if (isAnimatingRef.current) return; // our RAF animation handles its own updates

    const container = scrollContainerRef.current;
    if (!container) return;

    // Lightweight live update for arrows
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);

    // Debounced full refresh once scroll settles
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(refreshState, 80);
  }, [refreshState]);

  return (
    <div className={`relative carousel-container ${className}`} style={{ minWidth: 0, maxWidth: '100%' }}>
      {/* Left arrow — fades out when disabled instead of going grey */}
      {showControls && (
        <button
          type="button"
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className="carousel-nav left-[-16px]"
          style={{
            opacity: canScrollLeft ? 1 : 0,
            pointerEvents: canScrollLeft ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}
          aria-label={i18next.t('mediaCarousel.scrollLeft')}
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Scrollable strip */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto pb-2 carousel-scrollbar"
        style={{ scrollbarWidth: 'none', minWidth: 0, maxWidth: '100%' }}
      >
        {React.Children.map(children, (child, i) => (
          <div key={i} style={{ width: cardWidth, flexShrink: 0 }}>
            {child}
          </div>
        ))}
      </div>

      {/* Right arrow */}
      {showControls && (
        <button
          type="button"
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className="carousel-nav right-[-16px]"
          style={{
            opacity: canScrollRight ? 1 : 0,
            pointerEvents: canScrollRight ? 'auto' : 'none',
            transition: 'opacity 0.2s ease',
          }}
          aria-label={i18next.t('mediaCarousel.scrollRight')}
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Pagination dots — pill style: active dot stretches wider */}
      {isLoading ? (
        <div className="flex justify-center gap-2 mt-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        showControls && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-3">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => scrollToPage(index)}
                aria-label={`Aller à la page ${index + 1}`}
                aria-current={index === currentPage ? 'true' : undefined}
                style={{
                  width: index === currentPage ? '20px' : '8px',
                  height: '8px',
                  borderRadius: '999px',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: index === currentPage
                    ? 'var(--theme-accent, #7c3aed)'
                    : 'rgba(255,255,255,0.22)',
                  boxShadow: index === currentPage
                    ? '0 0 8px rgba(var(--theme-accent-rgb, 124,58,237), 0.55)'
                    : 'none',
                  transition: 'width 0.35s cubic-bezier(0.34,1.56,0.64,1), background 0.25s ease, box-shadow 0.25s ease',
                }}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
};