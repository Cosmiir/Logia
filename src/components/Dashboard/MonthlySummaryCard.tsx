import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MonthlySummaryCardProps {
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
  onStatusClick?: (status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ABANDONED' | 'COMPLETED') => void;
}

const normalizeRating = (rating: number): number => Math.round(rating);

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

const getRatingColor = (rating100: number): string => {
  if (rating100 >= 90) return '#22c55e'; // green
  if (rating100 >= 80) return '#a78bfa'; // purple
  if (rating100 >= 70) return '#3b82f6'; // blue
  if (rating100 >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // red
};

export const MonthlySummaryCard: React.FC<MonthlySummaryCardProps> = ({
  stats,
  isLoading = false,
  onStatusClick,
}) => {
  const { t, i18n } = useTranslation();

  const currentMonthLabel = useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat(i18n.language || 'fr', { month: 'long', year: 'numeric' }).format(now);
    } catch {
      return '';
    }
  }, [i18n.language]);

  const computedStats = useMemo(() => {
    if (!stats) return null;

    const rating100 = stats.rated_count > 0 ? normalizeRating(stats.average_rating) : 0;
    const trend = stats.trend_this_month - stats.trend_last_month;
    const total = stats.total_media || (stats.completed_count + stats.abandoned_count + stats.in_progress_count + stats.not_started_count) || 1;

    const completedPct = Math.round(((stats.completed_count || 0) / total) * 100);
    const inProgressPct = Math.round(((stats.in_progress_count || 0) / total) * 100);
    const notStartedPct = Math.round(((stats.not_started_count || 0) / total) * 100);
    const abandonedPct = Math.max(0, 100 - (completedPct + inProgressPct + notStartedPct));

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
      total,
      completedPct,
      inProgressPct,
      notStartedPct,
      abandonedPct,
      trend,
    };
  }, [stats, t]);

  if (isLoading || !computedStats) {
    return (
      <div className="glass-card p-5 sm:p-6 rounded-2xl h-[320px] sm:h-[350px] lg:h-[370px] animate-pulse flex flex-col justify-between border border-white/10">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-white/10 rounded w-28" />
          <div className="h-4 bg-white/10 rounded w-20" />
        </div>
        <div className="flex justify-between items-center py-2">
          <div className="space-y-2">
            <div className="h-8 bg-white/10 rounded w-16" />
            <div className="h-3 bg-white/10 rounded w-24" />
          </div>
          <div className="w-14 h-14 rounded-full bg-white/10" />
        </div>
        <div className="h-2.5 bg-white/10 rounded-full w-full" />
        <div className="grid grid-cols-4 gap-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-white/5 rounded-xl" />
          ))}
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
    total,
    completedPct,
    inProgressPct,
    notStartedPct,
    abandonedPct,
    trend,
  } = computedStats;

  const mediaThisMonth = stats?.media_this_month ?? 0;

  // SVG circle calculation
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rating100 / 100) * circumference;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? '#10b981' : trend < 0 ? 'rgba(255,255,255,0.7)' : '#9ca3af';
  const trendBg = trend > 0 ? 'rgba(16,185,129,0.14)' : trend < 0 ? 'rgba(255,255,255,0.08)' : 'rgba(156,163,175,0.12)';

  return (
    <div className="glass-card p-5 sm:p-5.5 rounded-2xl relative overflow-hidden flex flex-col justify-between border border-white/10 shadow-2xl group h-[320px] sm:h-[350px] lg:h-[370px]">
      {/* Ambient background glow */}
      <div
        className="absolute -right-8 -top-8 w-48 h-48 rounded-full blur-3xl opacity-15 pointer-events-none transition-all duration-700 group-hover:opacity-25"
        style={{ background: ratingColor }}
      />

      {/* Top row: Overview title + total count */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/[0.07] pb-2.5">
        <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
          {t('dashboard.libraryOverview')}
        </h3>

        <span className="text-[11px] font-semibold text-white/50 bg-white/[0.05] px-2.5 py-0.5 rounded-full border border-white/[0.08]">
          {t('dashboard.totalLibraryMedia', { count: total })}
        </span>
      </div>

      {/* Middle row: Activity & Average Score */}
      <div className="relative z-10 grid grid-cols-2 gap-3 items-center py-1">
        {/* Left: Added this month & trend */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-white/50 flex items-center gap-1.5">
            <span>{t('dashboard.mediaAddedThisMonth')}</span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <div className="text-3xl sm:text-4xl font-black text-white leading-none tracking-tight">
              {mediaThisMonth}
            </div>

            {/* Trend pill */}
            <div
              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: trendBg, color: trendColor }}
              title={t('statsExtra.vsLastMonth')}
            >
              <TrendIcon className="w-3 h-3" />
              <span>
                {trend > 0 ? '+' : ''}{trend}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-white/40 capitalize">
            {currentMonthLabel}
          </div>
        </div>

        {/* Right: Circular score ring with meta */}
        <div className="flex items-center justify-end gap-3">
          <div className="text-right min-w-0">
            <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {t('statsExtra.averageRating')}
            </div>
            <div
              className="text-xs sm:text-sm font-extrabold leading-tight truncate mt-0.5"
              style={{ color: ratingColor }}
            >
              {qualityLabel}
            </div>
            {totalReviews > 0 && (
              <div className="text-[10px] text-white/40 font-medium">
                {t('dashboard.ratedReviews', { count: totalReviews })}
              </div>
            )}
          </div>

          <div className="relative w-13 h-13 sm:w-14 sm:h-14 flex-shrink-0 group/ring">
            <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
              <circle
                cx="30"
                cy="30"
                r={radius}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="30"
                cy="30"
                r={radius}
                stroke={ratingColor}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm sm:text-base font-black text-white leading-none">
                {rating100}
              </span>
              <span className="text-[7.5px] font-bold text-white/40 leading-none mt-0.5">/100</span>
            </div>

            {/* Tooltip on ring */}
            {totalReviews > 0 && (
              <div
                className="pointer-events-none absolute right-0 top-full mt-1.5 z-30 opacity-0 translate-y-1 group-hover/ring:opacity-100 group-hover/ring:translate-y-0 transition-all duration-150 whitespace-nowrap bg-[#0f1019]/95 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white/80 shadow-xl"
              >
                Médiane <span className="text-white font-bold">{median}</span> · Écart <span className="text-white font-bold">±{stdDev}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Distribution visual progress bar */}
      <div className="relative z-10 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-semibold text-white/40 uppercase tracking-wider">
          <span>{t('dashboard.libraryDistribution')}</span>
          <span className="text-white/60 font-medium">
            {completedPct}% {t('status.progressStatus.COMPLETED')}
          </span>
        </div>

        {/* Multi-segment distribution bar */}
        <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-white/[0.08] p-0.5 gap-1 shadow-inner">
          {notStarted > 0 && (
            <div
              style={{ width: `${notStartedPct}%` }}
              className="h-full bg-indigo-400 rounded-full transition-all duration-500 hover:brightness-125 min-w-[6px]"
              title={`${t('status.progressStatus.NOT_STARTED')}: ${notStarted} (${notStartedPct}%)`}
            />
          )}
          {inProgress > 0 && (
            <div
              style={{ width: `${inProgressPct}%` }}
              className="h-full bg-sky-400 rounded-full transition-all duration-500 hover:brightness-125 min-w-[6px]"
              title={`${t('status.progressStatus.IN_PROGRESS')}: ${inProgress} (${inProgressPct}%)`}
            />
          )}
          {completed > 0 && (
            <div
              style={{ width: `${completedPct}%` }}
              className="h-full bg-emerald-400 rounded-full transition-all duration-500 hover:brightness-125 min-w-[6px]"
              title={`${t('status.progressStatus.COMPLETED')}: ${completed} (${completedPct}%)`}
            />
          )}
          {abandoned > 0 && (
            <div
              style={{ width: `${abandonedPct}%` }}
              className="h-full bg-rose-400 rounded-full transition-all duration-500 hover:brightness-125 min-w-[6px]"
              title={`${t('status.progressStatus.ABANDONED')}: ${abandoned} (${abandonedPct}%)`}
            />
          )}
        </div>
      </div>

      {/* Bottom: 4 Status Tiles — ordered by lifecycle */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 relative z-10">
        {/* Not Started */}
        <button
          type="button"
          onClick={() => onStatusClick?.('NOT_STARTED')}
          className="bg-white/[0.02] hover:bg-indigo-500/10 border border-white/[0.06] hover:border-indigo-500/30 rounded-xl p-2 sm:p-2.5 transition-all text-left cursor-pointer group/tile active:scale-95"
        >
          <div className="text-base sm:text-lg font-black text-indigo-400 leading-none mb-1 group-hover/tile:translate-x-0.5 transition-transform">
            {notStarted}
          </div>
          <div className="text-[9px] sm:text-[10px] font-semibold text-white/50 group-hover/tile:text-white/80 leading-tight truncate">
            {t('status.progressStatus.NOT_STARTED')}
          </div>
        </button>

        {/* In Progress */}
        <button
          type="button"
          onClick={() => onStatusClick?.('IN_PROGRESS')}
          className="bg-white/[0.02] hover:bg-sky-500/10 border border-white/[0.06] hover:border-sky-500/30 rounded-xl p-2 sm:p-2.5 transition-all text-left cursor-pointer group/tile active:scale-95"
        >
          <div className="text-base sm:text-lg font-black text-sky-400 leading-none mb-1 group-hover/tile:translate-x-0.5 transition-transform">
            {inProgress}
          </div>
          <div className="text-[9px] sm:text-[10px] font-semibold text-white/50 group-hover/tile:text-white/80 leading-tight truncate">
            {t('status.progressStatus.IN_PROGRESS')}
          </div>
        </button>

        {/* Completed */}
        <button
          type="button"
          onClick={() => onStatusClick?.('COMPLETED')}
          className="bg-white/[0.02] hover:bg-emerald-500/10 border border-white/[0.06] hover:border-emerald-500/30 rounded-xl p-2 sm:p-2.5 transition-all text-left cursor-pointer group/tile active:scale-95"
        >
          <div className="text-base sm:text-lg font-black text-emerald-400 leading-none mb-1 group-hover/tile:translate-x-0.5 transition-transform">
            {completed}
          </div>
          <div className="text-[9px] sm:text-[10px] font-semibold text-white/50 group-hover/tile:text-white/80 leading-tight truncate">
            {t('status.progressStatus.COMPLETED')}
          </div>
        </button>

        {/* Abandoned */}
        <button
          type="button"
          onClick={() => onStatusClick?.('ABANDONED')}
          className="bg-white/[0.02] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/30 rounded-xl p-2 sm:p-2.5 transition-all text-left cursor-pointer group/tile active:scale-95"
        >
          <div className="text-base sm:text-lg font-black text-rose-400 leading-none mb-1 group-hover/tile:translate-x-0.5 transition-transform">
            {abandoned}
          </div>
          <div className="text-[9px] sm:text-[10px] font-semibold text-white/50 group-hover/tile:text-white/80 leading-tight truncate">
            {t('status.progressStatus.ABANDONED')}
          </div>
        </button>
      </div>
    </div>
  );
};

export default MonthlySummaryCard;