import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Settings,
  Columns,
  ListCollapse
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { tauriApi } from '@/lib/tauri-api';
import { cn } from '@/lib/utils';

interface MangaReaderProps {
  mediaTitle: string;
  attachmentPath: string; // Relative path stored in DB
  attachmentName: string; // Original filename (e.g. "Tome 01.cbz")
  onClose: (currentPage: number, totalPages: number) => void;
  onComplete?: () => void;
}

type LayoutMode = 'single' | 'double' | 'webtoon';
type ReadingDirection = 'rtl' | 'ltr';
type FitMode = 'height' | 'width';

export const MangaReader: React.FC<MangaReaderProps> = ({
  mediaTitle,
  attachmentPath,
  attachmentName,
  onClose,
  onComplete
}) => {
  const { t } = useTranslation();
  const displayName = attachmentName.replace(/\.[^/.]+$/, "");
  // Page list and loading state
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reader settings
  const [pageIndex, setPageIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('single');
  const [direction, setDirection] = useState<ReadingDirection>('ltr');
  const [fitMode, setFitMode] = useState<FitMode>('height');
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Cache for loaded pages: pageName -> base64 dataUrl
  const [pageCache, setPageCache] = useState<Record<string, string>>({});
  const cacheRef = useRef<Record<string, string>>({});
  
  // Auto-hide controls timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and load page names
  useEffect(() => {
    const fetchPages = async () => {
      try {
        setLoading(true);
        const list = await tauriApi.media.getCbzPages(attachmentPath);
        if (list.length === 0) {
          setError(t('mangaReader.noPagesError'));
        } else {
          setPages(list);
          setPageIndex(0);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchPages();
  }, [attachmentPath]);

  // Load a page into cache if not present
  const loadPageToCache = useCallback(async (name: string) => {
    if (cacheRef.current[name]) return;
    try {
      const dataUrl = await tauriApi.media.readCbzPage(attachmentPath, name);
      cacheRef.current[name] = dataUrl;
      setPageCache((prev) => ({ ...prev, [name]: dataUrl }));
    } catch (err) {
      console.error(`Failed to load page ${name}:`, err);
    }
  }, [attachmentPath]);

  // Prefetch pages around the current index
  useEffect(() => {
    if (pages.length === 0) return;

    const pagesToLoad = new Set<string>();
    
    if (layoutMode === 'webtoon') {
      // For webtoon, we will lazy-load in the list component, but we prefetch the first 3 pages
      for (let i = 0; i < Math.min(3, pages.length); i++) {
        pagesToLoad.add(pages[i]);
      }
    } else if (layoutMode === 'double') {
      // Double page: load current pair, previous pair, and next pair
      const indices = [
        pageIndex,
        pageIndex + 1,
        pageIndex - 2,
        pageIndex - 1,
        pageIndex + 2,
        pageIndex + 3
      ];
      indices.forEach(idx => {
        if (idx >= 0 && idx < pages.length) pagesToLoad.add(pages[idx]);
      });
    } else {
      // Single page: load current, next 2, and previous 1
      const indices = [pageIndex, pageIndex + 1, pageIndex + 2, pageIndex - 1];
      indices.forEach(idx => {
        if (idx >= 0 && idx < pages.length) pagesToLoad.add(pages[idx]);
      });
    }

    pagesToLoad.forEach(name => {
      loadPageToCache(name);
    });
  }, [pageIndex, pages, layoutMode, loadPageToCache]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading || pages.length === 0) return;

      if (e.key === 'Escape') {
        onClose(pageIndex, pages.length);
      } else if (e.key === 'ArrowRight') {
        if (layoutMode !== 'webtoon') {
          if (direction === 'rtl') goPrevPage();
          else goNextPage();
        }
      } else if (e.key === 'ArrowLeft') {
        if (layoutMode !== 'webtoon') {
          if (direction === 'rtl') goNextPage();
          else goPrevPage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageIndex, pages, layoutMode, direction, loading, onClose]);

  // Handle controls visibility
  const triggerControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showSettings) {
        setShowControls(false);
      }
    }, 2500);
  };

  const toggleControls = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, [role="button"], a, select')) {
      return;
    }
    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      triggerControls();
    }
  };

  useEffect(() => {
    triggerControls();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showSettings]);

  // Navigation handlers
  const goNextPage = () => {
    if (pages.length === 0) return;
    if (layoutMode === 'double') {
      const nextIndex = pageIndex + 2;
      if (nextIndex < pages.length) {
        setPageIndex(nextIndex);
      } else {
        // Reached the end
        onComplete?.();
      }
    } else {
      if (pageIndex < pages.length - 1) {
        setPageIndex(prev => prev + 1);
      } else {
        // Reached the end
        onComplete?.();
      }
    }
  };

  const goPrevPage = () => {
    if (pages.length === 0) return;
    if (layoutMode === 'double') {
      const prevIndex = pageIndex - 2;
      setPageIndex(Math.max(0, prevIndex));
    } else {
      setPageIndex(prev => Math.max(0, prev - 1));
    }
  };

  // Render components for Double Page
  const renderDoublePage = () => {
    const page1Index = pageIndex;
    const page2Index = pageIndex + 1;

    const page1Name = pages[page1Index];
    const page2Name = page2Index < pages.length ? pages[page2Index] : null;

    const img1 = pageCache[page1Name];
    const img2 = page2Name ? pageCache[page2Name] : null;

    return (
      <div className={cn(
        "flex w-full h-full items-center justify-center gap-1 p-4 select-none",
        direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* Page 1 */}
        <div className={cn(
          "flex-1 h-full flex items-center",
          direction === 'rtl' ? "justify-start" : "justify-end"
        )}>
          {img1 ? (
            <img
              src={img1}
              alt={page1Name}
              className={cn(
                "object-contain max-w-full max-h-full",
                fitMode === 'height' ? 'h-full' : 'w-full'
              )}
              draggable={false}
            />
          ) : (
            <div className="w-40 h-60 rounded bg-white/5 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-white/30" />
            </div>
          )}
        </div>

        {/* Page 2 */}
        <div className={cn(
          "flex-1 h-full flex items-center",
          direction === 'rtl' ? "justify-end" : "justify-start"
        )}>
          {page2Name ? (
            img2 ? (
              <img
                src={img2}
                alt={page2Name}
                className={cn(
                  "object-contain max-w-full max-h-full",
                  fitMode === 'height' ? 'h-full' : 'w-full'
                )}
                draggable={false}
              />
            ) : (
              <div className="w-40 h-60 rounded bg-white/5 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/30" />
              </div>
            )
          ) : (
            // Blank page if odd count
            <div className="w-full h-full opacity-0" />
          )}
        </div>
      </div>
    );
  };

  const renderSinglePageImage = (name: string) => {
    const imgUrl = pageCache[name];
    if (!imgUrl) {
      return (
        <div className="w-64 h-96 rounded-2xl bg-white/5 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-xs text-white/30">{t('mangaReader.loadingPage')}</p>
          </div>
        </div>
      );
    }

    return (
      <img
        src={imgUrl}
        alt={name}
        className={cn(
          "object-contain select-none max-w-full max-h-full transition-all duration-300",
          fitMode === 'height' ? 'h-screen p-2' : 'w-full'
        )}
        draggable={false}
      />
    );
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] bg-black select-none overflow-hidden flex flex-col font-sans",
        !showControls && "cursor-none"
      )}
      onMouseMove={triggerControls}
      onClick={toggleControls}
    >
      {/* ERROR SCREEN */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center bg-black p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
            <X className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">{t('mangaReader.readError')}</h3>
          <p className="text-sm text-white/50 max-w-md">{error}</p>
          <button
            onClick={() => onClose(pageIndex, pages.length || 1)}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            {t('mangaReader.closeReader')}
          </button>
        </div>
      )}

      {/* LOADING SCREEN */}
      {loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center bg-black space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-sm text-white/40 font-medium">{t('mangaReader.loadingVolume')}</p>
        </div>
      )}

      {/* READER CONTENT */}
      {!loading && !error && pages.length > 0 && (
        <div className="relative flex-1 w-full h-full flex flex-col justify-between">
          
          {/* HEADER CONTROLS */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 inset-x-0 z-[110] bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onClose(pageIndex, pages.length)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-none mb-1">{displayName}</h2>
                    <p className="text-xs text-white/40 truncate max-w-xs md:max-w-md">{mediaTitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Settings toggle */}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                      showSettings ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white"
                    )}
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* READER WORKSPACE */}
          <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden flex items-center justify-center">
            
            {/* Nav zone left */}
            {layoutMode !== 'webtoon' && (
              <div 
                className="absolute left-0 inset-y-0 w-[15%] z-50 cursor-pointer flex items-center justify-start pl-4 group"
                onClick={(e) => { e.stopPropagation(); if (direction === 'rtl') goNextPage(); else goPrevPage(); }}
              >
                <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  {direction === 'rtl' ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                </div>
              </div>
            )}

            {/* Reading view */}
            <div className="w-full h-full flex items-center justify-center">
              {layoutMode === 'single' && renderSinglePageImage(pages[pageIndex])}
              {layoutMode === 'double' && renderDoublePage()}
              {layoutMode === 'webtoon' && (
                <WebtoonView 
                  pages={pages} 
                  pageCache={pageCache} 
                  loadPage={loadPageToCache} 
                  fitMode={fitMode}
                />
              )}
            </div>

            {/* Nav zone right */}
            {layoutMode !== 'webtoon' && (
              <div 
                className="absolute right-0 inset-y-0 w-[15%] z-50 cursor-pointer flex items-center justify-end pr-4 group"
                onClick={(e) => { e.stopPropagation(); if (direction === 'rtl') goPrevPage(); else goNextPage(); }}
              >
                <div className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  {direction === 'rtl' ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                </div>
              </div>
            )}

          </div>

          {/* SETTINGS PANEL OVERLAY */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="absolute top-20 right-4 z-[120] w-80 p-5 rounded-2xl bg-zinc-900/95 border border-white/10 backdrop-blur-xl shadow-2xl text-white space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-bold border-b border-white/5 pb-2">{t('mangaReader.readerSettings')}</h3>
                
                {/* Layout Mode */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">{t('mangaReader.pageMode')}</label>
                  <div className="grid grid-cols-3 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                    {[
                      { id: 'single', label: t('mangaReader.single'), icon: FileText },
                      { id: 'double', label: t('mangaReader.double'), icon: Columns },
                      { id: 'webtoon', label: t('mangaReader.webtoon'), icon: ListCollapse },
                    ].map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => { setLayoutMode(m.id as LayoutMode); if (m.id === 'double') setPageIndex(pageIndex - (pageIndex % 2)); }}
                          className={cn(
                            "py-1.5 rounded-md text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer",
                            layoutMode === m.id ? "bg-primary text-white shadow" : "text-white/60 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reading Direction */}
                {layoutMode !== 'webtoon' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">{t('mangaReader.readingDirection')}</label>
                    <div className="grid grid-cols-2 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                      {[
                        { id: 'rtl', label: t('mangaReader.rightToLeft') },
                        { id: 'ltr', label: t('mangaReader.leftToRight') },
                      ].map(d => (
                        <button
                          key={d.id}
                          onClick={() => setDirection(d.id as ReadingDirection)}
                          className={cn(
                            "py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                            direction === d.id ? "bg-primary text-white shadow" : "text-white/60 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fit Mode */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">{t('mangaReader.imageFit')}</label>
                  <div className="grid grid-cols-2 gap-1 bg-white/5 p-0.5 rounded-lg border border-white/5">
                    {[
                      { id: 'height', label: t('mangaReader.fitHeight') },
                      { id: 'width', label: t('mangaReader.fitWidth') },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setFitMode(f.id as FitMode)}
                        className={cn(
                          "py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                          fitMode === f.id ? "bg-primary text-white shadow" : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Close Settings */}
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {t('mangaReader.apply')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* BOTTOM NAVIGATION CONTROLS */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 inset-x-0 z-[110] bg-gradient-to-t from-black/90 to-transparent p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Page slider */}
                {layoutMode !== 'webtoon' && (
                  <div className="flex items-center gap-4 max-w-3xl mx-auto w-full">
                    <input
                      type="range"
                      min={0}
                      max={pages.length - 1}
                      value={pageIndex}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (layoutMode === 'double') {
                          setPageIndex(val - (val % 2));
                        } else {
                          setPageIndex(val);
                        }
                      }}
                      className="flex-1 accent-primary h-1 rounded bg-white/20 appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {/* Middle controls: numbers, prev, next */}
                <div className="flex items-center justify-between max-w-md mx-auto">
                  {layoutMode !== 'webtoon' ? (
                    <>
                      <button
                        onClick={goPrevPage}
                        disabled={pageIndex === 0}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <div className="text-center">
                        <span className="text-sm font-bold text-white tabular-nums">
                          {layoutMode === 'double' ? (
                            `${pageIndex + 1} - ${Math.min(pageIndex + 2, pages.length)}`
                          ) : (
                            pageIndex + 1
                          )}
                        </span>
                        <span className="text-xs text-white/35 ml-1">/ {pages.length}</span>
                      </div>

                      <button
                        onClick={goNextPage}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center mx-auto text-xs text-white/40">
                      {t('mangaReader.webtoonScroll', { count: pages.length })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}
    </div>
  );
};

// --- LAZY LOADED WEBTOON COMPONENT ---
interface WebtoonViewProps {
  pages: string[];
  pageCache: Record<string, string>;
  loadPage: (name: string) => Promise<void>;
  fitMode: FitMode;
}

const WebtoonView: React.FC<WebtoonViewProps> = ({ pages, pageCache, loadPage, fitMode }) => {
  return (
    <div className="w-full h-full overflow-y-auto flex flex-col items-center bg-zinc-950">
      <div className={cn(
        "flex flex-col items-center w-full",
        fitMode === 'width' ? 'max-w-4xl' : 'max-w-xl'
      )}>
        {pages.map((name, index) => (
          <WebtoonPage 
            key={name} 
            name={name} 
            index={index} 
            dataUrl={pageCache[name]} 
            loadPage={loadPage} 
          />
        ))}
      </div>
    </div>
  );
};

interface WebtoonPageProps {
  name: string;
  index: number;
  dataUrl?: string;
  loadPage: (name: string) => Promise<void>;
}

const WebtoonPage: React.FC<WebtoonPageProps> = ({ name, index, dataUrl, loadPage }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          loadPage(name);
        }
      },
      { rootMargin: '600px 0px 600px 0px' } // Load pages slightly before they scroll into view
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      if (containerRef.current) observer.unobserve(containerRef.current);
    };
  }, [name, loadPage]);

  return (
    <div 
      ref={containerRef} 
      className="w-full min-h-[400px] flex items-center justify-center bg-black/40 border-b border-zinc-900/50"
    >
      {isVisible && dataUrl ? (
        <img
          src={dataUrl}
          alt={`Page ${index + 1}`}
          className="w-full h-auto select-none"
          draggable={false}
          loading="lazy"
        />
      ) : (
        <div className="py-20 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-white/20" />
          <span className="text-[10px] text-white/10 uppercase tracking-wider font-semibold">Page {index + 1}</span>
        </div>
      )}
    </div>
  );
};
