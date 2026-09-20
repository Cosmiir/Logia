import React from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import { CheckCircle2, PlayCircle, PlusCircle, XCircle, PauseCircle, Star, ArrowRight } from 'lucide-react';
import { formatDateFr } from '@/lib/utils';
import type { ActivityItem } from '@/hooks/useDashboardExtra';
import type { Collection } from '@/types';

interface DashboardRecentActivityProps {
  activities: ActivityItem[];
  collectionMap?: Record<number, Collection>;
  isLoading?: boolean;
  onMediaClick: (mediaId: number) => void;
  onViewAllClick?: () => void;
}

function formatActivityDate(item: ActivityItem, t: any): string {
  if (item.experienceDate) {
    try {
      const expDate = new Date(item.experienceDate);
      const now = new Date();
      
      const expDay = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((today.getTime() - expDay.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return t('dashboard.today');
      if (diffDays === 1) return t('dashboard.yesterday');
      if (diffDays > 1 && diffDays < 7) return t('dashboard.daysAgo', { count: diffDays });
      return formatDateFr(item.experienceDate);
    } catch {
      return formatDateFr(item.experienceDate);
    }
  }

  try {
    const date = new Date(item.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return t('dashboard.justNow');
    if (diffHours < 1) return t('dashboard.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('dashboard.hoursAgo', { count: diffHours });
    return t('dashboard.daysAgo', { count: Math.max(1, diffDays) });
  } catch {
    return '';
  }
}

export const DashboardRecentActivity: React.FC<DashboardRecentActivityProps> = ({
  activities,
  collectionMap = {},
  isLoading = false,
  onMediaClick,
  onViewAllClick,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
        <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3 items-center animate-pulse">
              <div className="w-10 h-14 rounded-lg bg-white/10 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 bg-white/10 rounded w-3/4" />
                <div className="h-2.5 bg-white/5 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl space-y-3">
        <h3 className="text-sm font-bold text-white tracking-tight">
          {t('dashboard.recentActivity')}
        </h3>
        <p className="text-xs text-white/40 text-center py-6">
          {t('dashboard.noRecentActivity')}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 sm:p-6 rounded-2xl border border-white/10 shadow-xl flex flex-col justify-between h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
          {t('dashboard.recentActivity')}
        </h3>
        {onViewAllClick && (
          <button
            type="button"
            onClick={onViewAllClick}
            className="text-xs font-semibold text-white/40 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          >
            {t('dashboard.viewAll')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Activity List */}
      <div className="space-y-2.5 flex-1 flex flex-col justify-around">
        {activities.map((item) => {
          const coverSrc = item.coverImage
            ? `${convertFileSrc(item.coverImage)}?t=${item.updatedAt}`
            : null;

          const timeText = formatActivityDate(item, t);

          let detailLabel = t('status.progressStatus.NOT_STARTED');
          let StatusIcon = PlusCircle;
          let iconColor = '#818cf8';

          if (item.status === 'COMPLETED') {
            detailLabel = t('status.progressStatus.COMPLETED');
            StatusIcon = CheckCircle2;
            iconColor = '#10b981';
          } else if (item.status === 'IN_PROGRESS') {
            StatusIcon = PlayCircle;
            iconColor = '#38bdf8';
            if (item.progressCurrent != null && item.progressCurrent > 0) {
              const collection = item.collectionId ? collectionMap[item.collectionId] : null;
              const shortLabel = collection?.progression_short_label || null;
              const pluralWithS = collection?.plural_with_s ?? false;
              const getUnit = (n: number) =>
                shortLabel ? ` ${pluralWithS && n >= 2 ? shortLabel + 's' : shortLabel}` : '';
              detailLabel = `${item.progressCurrent}${getUnit(item.progressCurrent)}${
                item.progressTotal ? ` / ${item.progressTotal}${getUnit(item.progressTotal)}` : ''
              }`;
            } else {
              detailLabel = t('status.progressStatus.IN_PROGRESS');
            }
          } else if (item.status === 'ON_HOLD') {
            detailLabel = t('status.progressStatus.ON_HOLD') || 'En pause';
            StatusIcon = PauseCircle;
            iconColor = '#fbbf24';
          } else if (item.status === 'ABANDONED') {
            detailLabel = t('status.progressStatus.ABANDONED');
            StatusIcon = XCircle;
            iconColor = '#f43f5e';
          } else {
            detailLabel = t('common.added') || 'Ajouté';
          }

          return (
            <div
              key={item.id}
              onClick={() => onMediaClick(item.mediaId)}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] hover:border-white/10 transition-all duration-200 cursor-pointer group"
            >
              {/* Mini Cover Poster */}
              <div className="w-10 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 relative group-hover:border-white/30 transition-colors shadow-sm">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5 text-[9px] text-white/30 font-bold">
                    LOGO
                  </div>
                )}
              </div>

              {/* Text info */}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <StatusIcon className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                  <span className="text-[11px] text-white/50 font-medium truncate">
                    {timeText}
                  </span>
                  {item.rating != null && item.rating > 0 && (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-extrabold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                      <Star className="w-2.5 h-2.5 fill-amber-400" />
                      {item.rating}
                    </span>
                  )}
                </div>

                <div className="text-xs font-bold text-white group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                  {item.title}
                </div>

                <div className="text-[11px] font-medium text-white/40 truncate">
                  {detailLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardRecentActivity;
