import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus } from 'lucide-react';
import { MediaCarousel } from '@/components/MediaCarousel';
import { MemoizedMediaCard as MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import type { Media, Collection } from '@/types';

interface DashboardInProgressProps {
  mediaList: Media[];
  collectionMap: Record<number, Collection>;
  isLoading?: boolean;
  notStartedCount?: number;
  onMediaClick: (mediaId: number) => void;
  onViewAllClick: () => void;
  onContextMenu?: (e: React.MouseEvent, media: Media) => void;
  onDiscoverClick?: () => void;
  onStartMedia?: () => void;
  onQuickIncrement?: (media: Media, e: React.MouseEvent) => void;
}

export const DashboardInProgress: React.FC<DashboardInProgressProps> = ({
  mediaList,
  collectionMap,
  isLoading = false,
  notStartedCount = 0,
  onMediaClick,
  onViewAllClick,
  onContextMenu,
  onDiscoverClick,
  onStartMedia,
  onQuickIncrement,
}) => {
  const { t } = useTranslation();

  const getCollName = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.name ?? '' : '';
  const getCollIcon = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.icon ?? null : null;
  const getCollColor = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.color : undefined;
  const getCollProgressionLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.progression_label : undefined;
  const getCollProgressionShortLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.progression_short_label ?? undefined : undefined;
  const getCollPluralWithS = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.plural_with_s ?? false : false;
  const getCollCreatorLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.creator_label : undefined;
  const getCollExperienceDateLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.date_label : undefined;

  // ── SKELETON LOADING ──
  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5 sm:p-6 border border-white/10 shadow-xl h-full flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-52 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
        </div>
        <MediaCarousel isLoading>
          <MediaCardSkeleton count={4} />
        </MediaCarousel>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6 border border-white/10 shadow-xl h-full flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            {t('dashboard.resumeProgress')}
          </h2>
          <span className="text-xs font-bold text-white/60 bg-white/[0.06] px-2.5 py-0.5 rounded-full border border-white/[0.08] tabular-nums">
            {mediaList.length}
          </span>
        </div>

        {mediaList.length > 0 && (
          <button
            type="button"
            onClick={onViewAllClick}
            className="text-xs font-semibold text-white/50 hover:text-white transition-colors flex items-center gap-1 cursor-pointer ml-auto"
          >
            {t('dashboard.viewAll')} ({mediaList.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content Area */}
      {mediaList.length === 0 ? (
        <div className="py-14 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
          <p className="text-sm text-text-secondary">
            {t('dashboard.noInProgress')}
          </p>
          {onStartMedia && notStartedCount > 0 ? (
            <button
              type="button"
              onClick={onStartMedia}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary/20 hover:bg-primary/30 border border-primary/30 transition-colors cursor-pointer"
            >
              {t('dashboard.startNewMedia') || 'Démarrer une œuvre'} ({notStartedCount})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : onDiscoverClick ? (
            <button
              type="button"
              onClick={onDiscoverClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary/20 hover:bg-primary/30 border border-primary/30 transition-colors cursor-pointer"
            >
              {t('dashboard.discoverLibrary')}
            </button>
          ) : null}
        </div>
      ) : (
        <MediaCarousel>
          {mediaList.map((media: Media) => {
            const current = media.progress_current ?? 0;
            const total = media.progress_total ?? null;
            const pct = total && total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null;

            // Unit with automatic plural "s" if current >= 2
            const baseUnit = getCollProgressionLabel(media.collection_id) || getCollProgressionShortLabel(media.collection_id) || '';
            const pluralWithS = getCollPluralWithS(media.collection_id);
            let displayUnit = baseUnit;
            if (baseUnit && pluralWithS && current >= 2 && !baseUnit.toLowerCase().endsWith('s')) {
              displayUnit = `${baseUnit}s`;
            }

            const countStr = total ? `${current}/${total}` : `${current}`;
            const fullTitle = `${countStr}${displayUnit ? ` ${displayUnit}` : ''}${pct !== null ? ` (${pct}%)` : ''}`;

            const shortLabel = getCollProgressionShortLabel(media.collection_id) || baseUnit || 'ép.';
            const collColor = getCollColor(media.collection_id) || '#8b5cf6';

            return (
              <div
                key={media.id}
                data-media-id={media.id}
                className="relative group/resume-card h-full"
              >
                <MediaCard
                  media={media}
                  collectionName={getCollName(media.collection_id)}
                  collectionIcon={getCollIcon(media.collection_id)}
                  collectionColor={collColor}
                  progressionLabel={getCollProgressionLabel(media.collection_id)}
                  progressionShortLabel={shortLabel}
                  pluralWithS={pluralWithS}
                  creatorLabel={getCollCreatorLabel(media.collection_id)}
                  experienceDateLabel={getCollExperienceDateLabel(media.collection_id)}
                  onContextMenu={(e) => onContextMenu?.(e, media)}
                  onClick={() => onMediaClick(media.id)}
                />

                {/* Top Progression Pill + Quick Increment Action */}
                <div className="absolute top-2 left-2 right-2 z-30 pointer-events-none flex items-center justify-between gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-md shadow-md whitespace-nowrap overflow-hidden max-w-[calc(100%-34px)]"
                    style={{
                      backgroundColor: 'rgba(9, 10, 16, 0.88)',
                      color: collColor,
                      border: `1px solid ${collColor}44`,
                    }}
                    title={fullTitle}
                  >
                    <span className="truncate">
                      {countStr}{displayUnit ? ` ${displayUnit}` : ''}
                    </span>
                    {pct !== null && (
                      <span className="text-white/60 font-semibold shrink-0">· {pct}%</span>
                    )}
                  </span>

                  {onQuickIncrement && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickIncrement(media, e);
                      }}
                      className="pointer-events-auto shrink-0 w-6 h-6 rounded-lg bg-black/85 hover:bg-primary text-white border border-white/20 hover:border-primary shadow-lg transition-all active:scale-90 cursor-pointer flex items-center justify-center gap-0.5 group/plus"
                      title={`${t('dashboard.incrementProgress') || '+1 rapide'} (${current + 1} ${displayUnit || shortLabel})`}
                    >
                      <Plus className="w-3 h-3" />
                      <span className="text-[10px] font-extrabold pr-0.5 leading-none">1</span>
                    </button>
                  )}
                </div>

                {/* Bottom Progress Bar right above the info card bar (64px) */}
                {pct !== null && (
                  <div className="absolute left-0 right-0 bottom-[64px] z-20 h-1 bg-black/60 overflow-hidden pointer-events-none">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: collColor,
                        boxShadow: `0 0 6px ${collColor}`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Invitation card to fill dead space and suggest starting another title from the real watchlist */}
          {onStartMedia && (
            <button
              type="button"
              onClick={onStartMedia}
              className="h-full min-h-[240px] rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/50 bg-white/[0.02] hover:bg-white/[0.05] p-5 flex flex-col items-center justify-center text-center transition-all group/invite cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 group-hover/invite:bg-primary/20 flex items-center justify-center text-white/40 group-hover/invite:text-primary transition-colors mb-3">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-white/70 group-hover/invite:text-white transition-colors">
                {t('dashboard.quickStartSuggestion') || 'Démarrer une œuvre'}
              </span>
              <p className="text-[11px] text-white/40 mt-1 leading-snug line-clamp-2">
                {notStartedCount > 0
                  ? t('dashboard.inYourList', { count: notStartedCount })
                  : t('dashboard.discoverLibrary')}
              </p>
            </button>
          )}
        </MediaCarousel>
      )}
    </div>
  );
};

export default DashboardInProgress;
