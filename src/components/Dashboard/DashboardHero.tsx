import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight, Play, PlayCircle, Eye, ArrowRight, Sparkles, Settings2, X, Star, Check, Square, CheckSquare, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { getCollectionColor } from '@/components/MediaCard';
import type { Media, Collection } from '@/types';

export type HeroSpotlightMode = 'best_rated' | 'recent' | 'in_progress' | 'completed' | 'all';

interface HeroPreferences {
  mode: HeroSpotlightMode;
  selectedCollectionIds: number[];
  includeWithoutBackdrop: boolean;
}

interface DashboardHeroProps {
  allMediaWithBackdrops: Media[];
  collectionMap: Record<number, Collection>;
  onMediaClick: (mediaId: number) => void;
  onDiscoverClick: () => void;
}

const HERO_PREFS_KEY = 'logia_hero_prefs';
const HERO_MODE_KEY = 'logia_hero_spotlight_mode'; // legacy, migrated on first load

export const DashboardHero: React.FC<DashboardHeroProps> = ({
  allMediaWithBackdrops,
  collectionMap,
  onMediaClick,
  onDiscoverClick,
}) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [heroPrefs, setHeroPrefs] = useState<HeroPreferences>(() => {
    try {
      const saved = localStorage.getItem(HERO_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.mode === 'string' && Array.isArray(parsed.selectedCollectionIds)) {
          const mode = ['best_rated', 'recent', 'in_progress', 'completed', 'all'].includes(parsed.mode)
            ? (parsed.mode as HeroSpotlightMode)
            : 'best_rated';
          return {
            mode,
            selectedCollectionIds: parsed.selectedCollectionIds as number[],
            includeWithoutBackdrop: typeof parsed.includeWithoutBackdrop === 'boolean' ? parsed.includeWithoutBackdrop : false,
          };
        }
      }
      const legacy = localStorage.getItem(HERO_MODE_KEY);
      if (
        legacy === 'best_rated' ||
        legacy === 'recent' ||
        legacy === 'in_progress' ||
        legacy === 'all' ||
        legacy === 'completed'
      ) {
        return { mode: legacy as HeroSpotlightMode, selectedCollectionIds: [], includeWithoutBackdrop: false };
      }
    } catch {}
    return { mode: 'best_rated', selectedCollectionIds: [], includeWithoutBackdrop: false };
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdatePrefs = (updates: Partial<HeroPreferences>) => {
    setHeroPrefs((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(HERO_PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    setCurrentIndex(0);
    try {
      localStorage.removeItem(HERO_MODE_KEY);
    } catch {}
  };

  const handleModeChange = (mode: HeroSpotlightMode) => {
    handleUpdatePrefs({ mode });
    setShowSettingsModal(false);
  };

  // Filter by backdrop presence (unless includeWithoutBackdrop is on),
  // then by selected collections, then by mode.
  const filteredSlides = useMemo(() => {
    const pool = heroPrefs.includeWithoutBackdrop
      ? allMediaWithBackdrops
      : allMediaWithBackdrops.filter((m) => !!m.backdrop_image);
    const byCollections =
      heroPrefs.selectedCollectionIds.length > 0
        ? pool.filter(
            (m) => m.collection_id != null && heroPrefs.selectedCollectionIds.includes(m.collection_id)
          )
        : pool;

    if (heroPrefs.mode === 'best_rated') {
      // Prioritize rated media (sorted by rating desc), only fill with unrated
      // media if fewer than 8 rated ones exist — guarantees the "best rated"
      // mode actually surfaces rated media from the selected collection(s).
      const rated = byCollections
        .filter((m) => (m.user_rating ?? 0) > 0)
        .sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0));
      const rest = byCollections.filter((m) => (m.user_rating ?? 0) <= 0);
      return [...rated, ...rest].slice(0, 8);
    }
    if (heroPrefs.mode === 'in_progress') {
      const inProg = byCollections.filter((m) => m.progress_status === 'IN_PROGRESS');
      return (inProg.length > 0 ? inProg : byCollections).slice(0, 8);
    }
    if (heroPrefs.mode === 'completed') {
      const completed = byCollections.filter((m) => m.progress_status === 'COMPLETED');
      return (completed.length > 0 ? completed : byCollections).slice(0, 8);
    }
    if (heroPrefs.mode === 'recent') {
      return [...byCollections]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);
    }
    // 'all'
    return byCollections.slice(0, 8);
  }, [allMediaWithBackdrops, heroPrefs]);

  const hasSlides = filteredSlides.length > 0;
  const currentMedia = hasSlides ? filteredSlides[currentIndex % filteredSlides.length] : null;

  // Auto-rotation every 7 seconds
  useEffect(() => {
    if (!hasSlides || filteredSlides.length <= 1 || isHovered || showSettingsModal) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % filteredSlides.length);
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasSlides, filteredSlides.length, isHovered, showSettingsModal]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasSlides) return;
    setCurrentIndex((prev) => (prev - 1 + filteredSlides.length) % filteredSlides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasSlides) return;
    setCurrentIndex((prev) => (prev + 1) % filteredSlides.length);
  };

  const collections = useMemo(
    () => Object.values(collectionMap).sort((a, b) => a.name.localeCompare(b.name)),
    [collectionMap]
  );

  const collection = currentMedia?.collection_id ? collectionMap[currentMedia.collection_id] : null;
  const CollIcon = collection ? getCollectionIconComponent(collection.name, collection.icon) : null;
  const collColor = collection?.color || (collection ? getCollectionColor(collection.name) : '#8b5cf6');

  // Backdrop image source — falls back to cover image if no backdrop
  const backdropSrc = useMemo(() => {
    const imgPath = currentMedia?.backdrop_image || currentMedia?.cover_image;
    if (!imgPath) return null;
    return `${convertFileSrc(imgPath)}?t=${currentMedia.updated_at || currentMedia.created_at}`;
  }, [currentMedia]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden glass-card group/hero h-[320px] sm:h-[350px] lg:h-[370px] flex flex-col justify-end p-6 sm:p-7 transition-all duration-500 border border-white/10 shadow-2xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image - Expansive and cinematic */}
      {backdropSrc ? (
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          <img
            key={backdropSrc}
            src={backdropSrc}
            alt=""
            className="w-full h-full object-cover object-center filter brightness-[0.82] contrast-[1.04] transition-all duration-700 ease-out transform group-hover/hero:scale-[1.02]"
            draggable={false}
          />
          {/* Multi-stage Scrim Gradients with expansive backdrop view */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to right, rgba(9,10,16,0.92) 0%, rgba(9,10,16,0.72) 36%, rgba(9,10,16,0.30) 65%, rgba(9,10,16,0.12) 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(9,10,16,0.94) 0%, rgba(9,10,16,0.35) 45%, transparent 100%)',
            }}
          />
          {/* Subtle Color Accent Glow */}
          <div
            className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
            style={{ background: collColor }}
          />
        </div>
      ) : (
        /* Fallback Atmospheric Gradient */
        <div className="absolute inset-0 pointer-events-none select-none bg-gradient-to-br from-purple-950/40 via-background to-blue-950/30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* Settings gear button */}
      <button
        type="button"
        onClick={() => setShowSettingsModal(true)}
        className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-black/50 hover:bg-black/80 text-white/60 hover:text-white border border-white/10 backdrop-blur-md opacity-40 group-hover/hero:opacity-100 transition-all duration-200 cursor-pointer"
        title={t('dashboard.heroSettings')}
      >
        <Settings2 className="w-4 h-4" />
      </button>

      {/* Hero Content with fixed text area preventing any container resize */}
      <div className="relative z-10 max-w-[460px] lg:max-w-[500px] space-y-2.5">
        {currentMedia ? (
          <>
            {/* Tag / Collection info + Status */}
            <div className="flex items-center gap-2 flex-wrap min-h-6">
              {collection && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md border border-white/10 shrink-0"
                  style={{
                    backgroundColor: `${collColor}22`,
                    color: collColor,
                    borderColor: `${collColor}44`,
                  }}
                >
                  {CollIcon && <CollIcon className="w-3.5 h-3.5" />}
                  {collection.name}
                </span>
              )}
              {currentMedia.progress_status === 'COMPLETED' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('dashboard.statusCompleted') || 'Terminé'}
                </span>
              )}
              {currentMedia.progress_status === 'IN_PROGRESS' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
                  <PlayCircle className="w-3 h-3" />
                  {t('dashboard.statusInProgress') || 'En cours'}
                </span>
              )}
              {currentMedia.progress_status === 'NOT_STARTED' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                  <Clock className="w-3 h-3" />
                  {t('dashboard.statusNotStarted') || 'À commencer'}
                </span>
              )}
              {currentMedia.progress_status === 'ABANDONED' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <XCircle className="w-3 h-3" />
                  {t('dashboard.statusAbandoned') || 'Abandonné'}
                </span>
              )}
              {currentMedia.user_rating != null && currentMedia.user_rating > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full backdrop-blur-md shrink-0">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {currentMedia.user_rating}/100
                </span>
              )}
            </div>

            {/* Title with single line height / clamp to keep container locked */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight line-clamp-1 drop-shadow-md">
              {currentMedia.title}
            </h1>

            {/* Synopsis */}
            <p className="text-xs sm:text-sm text-white/70 line-clamp-2 leading-relaxed drop-shadow h-10">
              {currentMedia.synopsis || t('dashboard.heroSubtitle')}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onMediaClick(currentMedia.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-primary/20 hover:bg-primary/30 border border-primary/30 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-sm"
              >
                {currentMedia.progress_status === 'COMPLETED' ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    {t('dashboard.viewDetails')}
                  </>
                ) : currentMedia.progress_status === 'IN_PROGRESS' ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    {t('dashboard.continueMedia')}
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-3.5 h-3.5" />
                    {t('dashboard.startMedia')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onDiscoverClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-sm"
              >
                {t('dashboard.discoverLibrary')}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          /* Default Welcome */
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Logia</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md line-clamp-1">
              {t('dashboard.heroExplore')}
            </h1>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed drop-shadow h-10 line-clamp-2">
              {t('dashboard.heroSubtitle')}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={onDiscoverClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-primary/20 hover:bg-primary/30 border border-primary/30 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-sm"
              >
                {t('dashboard.discoverLibrary')}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Slide Navigation Controls */}
      {filteredSlides.length > 1 && (
        <div className="absolute right-6 bottom-6 z-20 flex items-center gap-2.5">
          {/* Pagination Dots */}
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10">
            {filteredSlides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === (currentIndex % filteredSlides.length)
                    ? 'w-5 bg-primary'
                    : 'w-1.5 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          {/* Prev/Next Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 rounded-xl bg-black/50 hover:bg-black/80 text-white/80 hover:text-white border border-white/15 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 rounded-xl bg-black/50 hover:bg-black/80 text-white/80 hover:text-white border border-white/15 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal (Rendered via React Portal at body level for perfect full-screen backdrop blur) */}
      {showSettingsModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
            onClick={() => setShowSettingsModal(false)}
          >
            <div
              className="w-full max-w-3xl rounded-2xl glass-card border border-white/15 p-6 space-y-5 shadow-2xl bg-[#0f1019]/95 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  {t('dashboard.heroSettings')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Left column: Mode selection */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-white/60 mb-2">
                    {t('dashboard.heroMode')}
                  </div>

                  {[
                    { id: 'best_rated', label: t('dashboard.heroModeBestRated'), desc: t('dashboard.heroModeBestRatedDesc') },
                    { id: 'in_progress', label: t('dashboard.heroModeInProgress'), desc: t('dashboard.heroModeInProgressDesc') },
                    { id: 'completed', label: t('dashboard.heroModeCompleted'), desc: t('dashboard.heroModeCompletedDesc') },
                    { id: 'recent', label: t('dashboard.heroModeRecent'), desc: t('dashboard.heroModeRecentDesc') },
                    { id: 'all', label: t('dashboard.heroModeAll'), desc: t('dashboard.heroModeAllDesc') },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleModeChange(opt.id as HeroSpotlightMode)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all cursor-pointer border ${
                        heroPrefs.mode === opt.id
                          ? 'bg-primary/20 text-white border-primary/50 shadow-md shadow-primary/10'
                          : 'bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.07] border-white/5'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[11px] text-white/40 mt-0.5">{opt.desc}</div>
                      </div>
                      {heroPrefs.mode === opt.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 ml-2" />
                      )}
                    </button>
                  ))}

                  {/* Toggle: include media without backdrop */}
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdatePrefs({ includeWithoutBackdrop: !heroPrefs.includeWithoutBackdrop })
                    }
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all cursor-pointer border ${
                      heroPrefs.includeWithoutBackdrop
                        ? 'bg-primary/20 text-white border-primary/50 shadow-md shadow-primary/10'
                        : 'bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.07] border-white/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold">{t('dashboard.heroIncludeWithoutBackdrop')}</div>
                      <div className="text-[11px] text-white/40 mt-0.5">{t('dashboard.heroIncludeWithoutBackdropDesc')}</div>
                    </div>
                    <div
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ml-2 ${
                        heroPrefs.includeWithoutBackdrop ? 'bg-primary' : 'bg-white/15'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          heroPrefs.includeWithoutBackdrop ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </div>
                  </button>
                </div>

                {/* Right column: Collections filter */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-white/60">
                      {t('dashboard.heroCollectionFilter')}
                    </div>
                    <span className="text-[11px] text-white/40 tabular-nums">
                      {t('dashboard.heroSelectedCount', { count: heroPrefs.selectedCollectionIds.length, total: collections.length })}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40">
                    {t('dashboard.heroCollectionFilterHint')}
                  </p>

                  {/* Select all / Deselect all actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdatePrefs({ selectedCollectionIds: collections.map((c) => c.id) })
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      {t('dashboard.heroSelectAll')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdatePrefs({ selectedCollectionIds: [] })}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5" />
                      {t('dashboard.heroDeselectAll')}
                    </button>
                  </div>

                  <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                    {collections.map((c) => {
                      const isSelected = heroPrefs.selectedCollectionIds.includes(c.id);
                      const Icon = getCollectionIconComponent(c.name, c.icon);
                      const color = c.color || getCollectionColor(c.name);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const next = new Set(heroPrefs.selectedCollectionIds);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            handleUpdatePrefs({ selectedCollectionIds: Array.from(next) });
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-white/[0.07] text-white border-white/10'
                              : 'bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.05] border-white/5'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 text-xs">
                            {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
                            {c.name}
                          </span>
                          {isSelected ? (
                            <div className="w-4 h-4 rounded bg-primary/80 flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          ) : (
                            <Square className="w-4 h-4 text-white/30" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DashboardHero;