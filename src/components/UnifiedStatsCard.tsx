import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface UnifiedStatsCardProps {
  stats: {
    total_media: number;
    media_this_month: number;
    average_rating: number;
    completed_count: number;
    abandoned_count: number;
    in_progress_count: number;
    not_started_count: number;
    rated_count: number;
    rating_median: number;
    rating_std_dev: number;
    trend_this_month: number;
    trend_last_month: number;
  } | undefined;
  isLoading?: boolean;
}

// Rating scale: already normalized (0-100)
const normalizeRating = (rating: number): number => Math.round(rating);

// Get quality label based on rating (0-100 scale)
const getQualityLabel = (rating100: number, t: any): string => {
  if (rating100 >= 95) return t('stats.quality.exceptional');
  if (rating100 >= 90) return t('stats.quality.excellent');
  if (rating100 >= 85) return t('stats.quality.veryGood');
  if (rating100 >= 80) return t('stats.quality.good');
  if (rating100 >= 70) return t('stats.quality.fair');
  if (rating100 >= 60) return t('stats.quality.average');
  if (rating100 >= 50) return t('stats.quality.poor');
  return t('stats.quality.needsImprovement');
};

// Get color based on rating (0-100 scale)
const getRatingColor = (rating100: number): string => {
  if (rating100 >= 90) return '#22c55e'; // green
  if (rating100 >= 80) return '#a78bfa'; // purple
  if (rating100 >= 70) return '#3b82f6'; // blue
  if (rating100 >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

interface ComputedStats {
  rating100: number;
  ratingColor: string;
  qualityLabel: string;
  totalReviews: number;
  median: number;
  stdDev: number;
  completed: number;
  abandoned: number;
  inProgress: number;
  notStarted: number;
  trend: number;
  lastMonthCount: number;
}

export const UnifiedStatsCard: React.FC<UnifiedStatsCardProps> = ({
  stats,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const computedStats: ComputedStats | null = useMemo(() => {
    if (!stats) return null;

    const rating100 = normalizeRating(stats.average_rating);
    const trend = stats.trend_this_month - stats.trend_last_month;

    return {
      rating100,
      ratingColor: getRatingColor(rating100),
      qualityLabel: getQualityLabel(rating100, t),
      totalReviews: stats.rated_count,
      median: stats.rating_median,
      stdDev: stats.rating_std_dev,
      completed: stats.completed_count,
      abandoned: stats.abandoned_count,
      inProgress: stats.in_progress_count,
      notStarted: stats.not_started_count,
      bestRated: null, // Calcul côté backend si nécessaire
      trend,
      lastMonthCount: stats.trend_last_month,
    };
  }, [stats]);

  if (isLoading || !computedStats) {
    return (
      <div className="glass-card p-6 rounded-2xl min-h-[200px] animate-pulse">
        <div className="flex gap-6 h-full">
          <div className="flex-1 space-y-3">
            <div className="h-3 bg-white/10 rounded w-24"></div>
            <div className="h-10 bg-white/10 rounded w-16"></div>
          </div>
          <div className="w-px bg-white/10"></div>
          <div className="flex-[2] flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/10"></div>
            <div className="space-y-2">
              <div className="h-3 bg-white/10 rounded w-20"></div>
              <div className="h-6 bg-white/10 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    rating100,
    ratingColor,
    qualityLabel,
    totalReviews,
    median,
    stdDev,
    completed,
    abandoned,
    inProgress,
    notStarted,
    trend,
  } = computedStats;

  const totalMedia = stats?.total_media ?? 0;
  const mediaThisMonth = stats?.media_this_month ?? 0;

  // SVG circle progress
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rating100 / 100) * circumference;

  // Trend indicator
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : '#6b7280';
  const trendBg = trend > 0 ? 'rgba(34,197,94,0.12)' : trend < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(107,114,128,0.12)';

  return (
    <div className="glass-card p-5 sm:p-6 rounded-2xl relative overflow-hidden group">
      {/* Background glow */}
      <div
        className="absolute -right-8 -top-8 w-40 h-40 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-all duration-700"
        style={{ background: ratingColor }}
      ></div>

      <div className="relative z-10">
        {/* Top section */}
        <div className="flex gap-4 sm:gap-6 items-stretch">
          {/* Left: This month stats */}
          <div className="flex-1 flex flex-col justify-between min-w-[120px]">
            <div>
              <div className="text-[10px] sm:text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">
                {t('statsExtra.thisMonth')}
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white leading-none">
                {mediaThisMonth}
              </div>
              <div className="text-xs text-white/40 mt-1">
                {t('statsExtra.totalMedia', { count: totalMedia })}
              </div>
            </div>

            {/* Trend badge */}
            <div
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full w-fit mt-3"
              style={{ background: trendBg, color: trendColor }}
            >
              <TrendIcon className="w-3 h-3" />
              <span>
                {trend > 0 ? '+' : ''}{trend} {t('statsExtra.vsLastMonth')}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-white/10 self-stretch"></div>

          {/* Right: Rating section */}
          <div className="flex-[2] flex items-center gap-4 min-w-0">
            {/* Circular rating badge */}
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
              <svg
                viewBox="0 0 72 72"
                className="w-full h-full -rotate-90"
              >
                {/* Background circle */}
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="5"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke={ratingColor}
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg sm:text-xl font-extrabold text-white leading-none">
                  {rating100}
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-white/40">
                  /100
                </span>
              </div>
            </div>

            {/* Rating meta */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] sm:text-xs font-semibold text-white/40 uppercase tracking-wider mb-0.5">
                {t('statsExtra.averageRating')}
              </div>
              <div
                className="text-lg sm:text-xl font-extrabold leading-none mb-1 truncate"
                style={{ color: ratingColor }}
              >
                {qualityLabel}
              </div>
              <div className="text-[10px] sm:text-xs text-white/40">
                {t('stats.basedOn', { reviews: totalReviews })}
              </div>
              {totalReviews > 0 && (
                <div className="text-[10px] sm:text-xs text-white/30 mt-0.5">
                  {t('statsExtra.median')} <span className="text-white/50 font-medium">{median}</span>
                  {' · '}
                  {t('statsExtra.deviation')} <span className="text-white/50 font-medium">±{stdDev}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 my-4"></div>

        {/* Bottom: Mini stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Not Started */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] font-semibold text-indigo-400/80 uppercase tracking-wider mb-1">
              {t('statsExtra.notStarted')}
            </div>
            <div className="text-base sm:text-lg font-extrabold text-indigo-400 leading-none mb-1">
              {notStarted}
            </div>
            <div className="text-[10px] sm:text-xs text-white/30">
              {t('dashboard.waitingList')}
            </div>
          </div>

          {/* In Progress */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] font-semibold text-sky-400/80 uppercase tracking-wider mb-1">
              {t('dashboard.inProgressShort')}
            </div>
            <div className="text-base sm:text-lg font-extrabold text-sky-400 leading-none mb-1">
              {inProgress}
            </div>
            <div className="text-[10px] sm:text-xs text-white/30">
              {t('dashboard.inProgressText')}
            </div>
          </div>

          {/* Abandoned */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] font-semibold text-rose-400/80 uppercase tracking-wider mb-1">
              {t('statsExtra.abandoned')}
            </div>
            <div className="text-base sm:text-lg font-extrabold text-rose-400 leading-none mb-1">
              {abandoned}
            </div>
            <div className="text-[10px] sm:text-xs text-white/30">
              {t('statsExtra.putAside')}
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 sm:p-3">
            <div className="text-[9px] sm:text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider mb-1">
              {t('statsExtra.completed')}
            </div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-400 leading-none mb-1">
              {completed}
            </div>
            <div className="text-[10px] sm:text-xs text-white/30">
              {t('dashboard.outOfMedia', { count: totalMedia })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
