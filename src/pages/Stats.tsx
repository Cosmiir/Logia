import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import {
  BarChart3, TrendingUp, Star, Calendar, Target, Hash, Flame,
  Award, BookOpen, Tv, Film,
  Eye, RotateCcw, Minus,
} from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ObjectiveCard from '@/components/ObjectiveCard';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { useCollections } from '@/hooks/useCollections';
import { useMedia } from '@/hooks/useMedia';
import { useDashboardStats } from '@/hooks/useStats';
import { useObjectives } from '@/hooks/useObjectives';
import { getRatingColor } from '@/utils/ratingColors';
import { getProgressStatus } from '@/lib/utils';
import { getProgressStatusLabel, PROGRESS_STATUS_LABELS, PROGRESS_STATUS_COLORS } from '@/lib/status-labels';
import type { Media, Collection, Genre, ProgressStatus } from '@/types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useNavigationStore } from '@/stores/useNavigationStore';

/* ================================================================== */
/*  Period selector helpers                                            */
/* ================================================================== */
type PeriodType = 'all' | 'year' | 'month' | 'custom';
interface PeriodFilter {
  type: PeriodType;
  year?: number;
  month?: number; // 0-indexed
  from?: string;
  to?: string;
}

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function filterMediaByPeriod(media: Media[], period: PeriodFilter): Media[] {
  if (period.type === 'all') return media;
  return media.filter(m => {
    const dateStr = m.experience_date || m.created_at;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (period.type === 'year') return d.getFullYear() === period.year;
    if (period.type === 'month') return d.getFullYear() === period.year && d.getMonth() === period.month;
    if (period.type === 'custom') {
      if (period.from && d < new Date(period.from)) return false;
      if (period.to && d > new Date(period.to)) return false;
      return true;
    }
    return true;
  });
}


/* ================================================================== */
/*  SVG Chart Components                                               */
/* ================================================================== */

/** Donut Chart with interactions */
const StatusDonutChart: React.FC<{
  data: { label: string; value: number; color: string; shortLabel: string; id?: number | string }[];
  size?: number;
  strokeWidth?: number;
  selectedIds?: (number | string)[];
  onToggleSelect?: (id: number | string) => void;
}> = ({ data, size = 160, strokeWidth = 26, selectedIds, onToggleSelect }) => {
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
  const hasSelection = selectedIds !== undefined && selectedIds.length > 0;
  const isSelectable = onToggleSelect !== undefined;

  const radius = (size - strokeWidth) / 2;
  const gapDeg = 2;

  const segments = useMemo(() => {
    let angleCursor = 0;
    return data.map((d, i) => {
      const pct = d.value / total || 0;
      const spanDeg = pct * 360 - gapDeg;
      const startDeg = angleCursor + gapDeg / 2;
      const endDeg = startDeg + spanDeg;
      angleCursor += pct * 360;
      return { ...d, startDeg, endDeg, pct, index: i };
    });
  }, [data, total]);

  const polarToCart = (angleDeg: number, r: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: size / 2 + r * Math.cos(rad),
      y: size / 2 + r * Math.sin(rad),
    };
  };

  const buildArcPath = (startDeg: number, endDeg: number, r: number, sw: number) => {
    const outerR = r + sw / 2;
    const innerR = r - sw / 2;
    const s1 = polarToCart(startDeg, outerR);
    const e1 = polarToCart(endDeg, outerR);
    const s2 = polarToCart(endDeg, innerR);
    const e2 = polarToCart(startDeg, innerR);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s1.x} ${s1.y} A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y} Z`;
  };

  // Center label logic
  let centerLabel: string;
  let centerValue: number;
  if (activeIdx !== -1) {
    centerLabel = data[activeIdx]?.shortLabel || data[activeIdx]?.label.split(' ')[0];
    centerValue = data[activeIdx]?.value ?? 0;
  } else if (hasSelection) {
    const selectedData = data.filter(d => d.id !== undefined && selectedIds!.includes(d.id));
    centerLabel = `${selectedData.length} ✓`;
    centerValue = selectedData.reduce((s, d) => s + d.value, 0);
  } else {
    centerLabel = 'TOTAL';
    centerValue = total;
  }

  return (
    <div className="flex items-center gap-8 flex-wrap" style={{ overflow: 'visible' }}>
      {/* Donut SVG */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, cursor: isSelectable ? 'pointer' : 'default', overflow: 'visible' }}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {segments.map((seg) => {
          const isActive = activeIdx === seg.index;
          const isHoverDimmed = activeIdx !== -1 && !isActive;
          const isSelected = !hasSelection || (seg.id !== undefined && selectedIds!.includes(seg.id));
          const isSelectionDimmed = hasSelection && !isSelected;
          const opacity = isSelectionDimmed ? 0.15 : isHoverDimmed ? 0.2 : 1;
          const scale = isActive ? 1.07 : (hasSelection && isSelected ? 1.03 : 1);
          return (
            <path
              key={seg.index}
              d={buildArcPath(seg.startDeg, seg.endDeg, radius, strokeWidth)}
              fill={seg.color}
              opacity={opacity}
              style={{
                transition: 'opacity 0.2s, transform 0.2s',
                transformOrigin: `${size / 2}px ${size / 2}px`,
                transform: `scale(${scale})`,
              }}
              onMouseEnter={() => setActiveIdx(seg.index)}
              onMouseLeave={() => setActiveIdx(-1)}
              onClick={() => isSelectable && seg.id !== undefined && onToggleSelect!(seg.id)}
            />
          );
        })}
        {/* Center text */}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="fill-white/40 text-[11px]">
          {centerLabel}
        </text>
        <text x={size / 2} y={size / 2 + 17} textAnchor="middle" className="fill-white text-[22px] font-bold">
          {centerValue}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-[180px]">
        {data.map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) + '%' : '—';
          const isActive = activeIdx === i;
          const isHoverDimmed = activeIdx !== -1 && !isActive;
          const isSelected = !hasSelection || (d.id !== undefined && selectedIds!.includes(d.id));
          const isSelectionDimmed = hasSelection && !isSelected;
          const isDimmed = isHoverDimmed || isSelectionDimmed;
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all border ${
                isActive ? 'bg-white/[0.06] border-white/10' : 'border-transparent hover:bg-white/[0.06] hover:border-white/10'
              } ${hasSelection && isSelected && !isActive ? 'bg-white/[0.03] border-white/5' : ''}`}
              style={{ opacity: isSelectionDimmed ? 0.4 : 1 }}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(-1)}
              onClick={() => isSelectable && d.id !== undefined && onToggleSelect!(d.id)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                style={{ backgroundColor: d.color, transform: isActive ? 'scale(1.4)' : 'scale(1)' }}
              />
              <span
                className="text-xs font-bold uppercase flex-1 transition-opacity"
                style={{ color: d.color, opacity: isDimmed ? 0.3 : 1 }}
              >
                {d.label}
              </span>
              <span
                className="text-xs font-semibold text-white tabular-nums transition-opacity"
                style={{ opacity: isDimmed ? 0.3 : 1 }}
              >
                {d.value}
              </span>
              <span
                className="text-[10px] text-white/30 tabular-nums w-8 text-right transition-opacity"
                style={{ opacity: isDimmed ? 0.3 : 1 }}
              >
                {pct}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Horizontal Bar Chart */
const HBarChart: React.FC<{
  data: { label: string; value: number; color: string; icon?: React.ElementType }[];
  maxValue?: number;
  showValues?: boolean;
}> = ({ data, maxValue, showValues = true }) => {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const Icon = d.icon;
        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-sm text-white/70 min-w-0">
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: d.color }} />}
                <span className="truncate">{d.label}</span>
              </div>
              {showValues && <span className="text-xs font-semibold text-white/50 tabular-nums ml-2 shrink-0">{d.value}</span>}
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                  background: `linear-gradient(to right, ${d.color}, ${d.color}aa)`,
                  boxShadow: `0 0 8px ${d.color}30`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Vertical Bar Chart (for histogram/timeline) */
const VBarChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  height?: number;
  barColor?: string;
  showLabels?: boolean;
}> = ({ data, height = 160, barColor = '#8B5CF6', showLabels = true }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.max(8, Math.min(40, 600 / data.length - 4));
  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <div className="flex items-end gap-1 justify-center" style={{ minHeight: height, minWidth: data.length * (barWidth + 4) }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1 group" style={{ width: barWidth }}>
            <span className="text-[9px] text-white/40 font-medium tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
              {d.value}
            </span>
            <div
              className="w-full rounded-t-sm transition-all duration-500 group-hover:brightness-125 cursor-default"
              style={{
                height: `${Math.max((d.value / max) * (height - 30), d.value > 0 ? 3 : 1)}px`,
                background: `linear-gradient(to top, ${d.color || barColor}, ${d.color || barColor}bb)`,
                boxShadow: d.value > 0 ? `0 0 6px ${d.color || barColor}25` : 'none',
              }}
              title={`${d.label}: ${d.value}`}
            />
            {showLabels && (
              <span className="text-[8px] text-white/25 font-medium whitespace-nowrap">{d.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Stat Number Card */
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}> = ({ label, value, sub, icon: Icon, color }) => (
  <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
    <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full blur-3xl group-hover:opacity-40 transition-all duration-700 opacity-25" style={{ backgroundColor: color }} />
    <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
      <Icon className="w-14 h-14" style={{ color }} />
    </div>
    <div className="z-10 relative">
      <h3 className="text-text-secondary text-xs font-medium mb-1">{label}</h3>
      <span className="text-2xl font-bold text-white drop-shadow-sm">{value}</span>
      {sub && <p className="text-[10px] text-text-secondary mt-1">{sub}</p>}
    </div>
  </div>
);

/** Section Card wrapper */
const Section: React.FC<{
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}> = ({ title, icon: Icon, iconColor = '#8B5CF6', children, className = '', action }) => (
  <div className={`glass-card rounded-2xl p-6 ${className}`}>
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-base font-bold text-white flex items-center gap-2">
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
        {title}
      </h2>
      {action}
    </div>
    {children}
  </div>
);

/* ================================================================== */
/*  Top / Bottom media list                                            */
/* ================================================================== */
const MediaRankList: React.FC<{
  media: Media[];
  collections: Collection[];
  direction: 'top' | 'bottom';
}> = ({ media, collections, direction }) => {
  const { navigateToMediaDetail } = useNavigationStore();
  const items = useMemo(() => {
    const rated = media.filter(m => m.user_rating !== null && m.user_rating > 0);
    const sorted = [...rated].sort((a, b) =>
      direction === 'top' ? (b.user_rating! - a.user_rating!) : (a.user_rating! - b.user_rating!)
    );
    return sorted.slice(0, 5);
  }, [media, direction]);

  if (items.length === 0) return <p className="text-xs text-white/20 text-center py-4">{i18next.t('stats.noRatedMedia')}</p>;
  return (
    <div className="space-y-2">
      {items.map((m, i) => {
        const coll = collections.find(c => c.id === m.collection_id);
        const Icon = coll ? getCollectionIconComponent(coll.name, coll.icon) : BookOpen;
        const collColor = coll?.color || '#8B5CF6';
        const hasCover = !!m.cover_image;
        const coverUrl = hasCover ? `${convertFileSrc(m.cover_image!)}?t=${m.updated_at}` : null;
        const rating = m.user_rating;
        const ratingColor = getRatingColor(rating!);
        const status = m.progress_status;
        const statusLabel = status ? (PROGRESS_STATUS_LABELS[status] ?? status) : null;
        const statusColor = status ? (PROGRESS_STATUS_COLORS[status] ?? '#ffffff') : null;
        const creators = m.creator ? m.creator.split(';').map(c => c.trim()).filter(Boolean) : [];
        return (
          <div
            key={m.id}
            onClick={() => navigateToMediaDetail(m.id)}
            className="flex items-stretch gap-2.5 py-1.5 px-2 rounded-lg hover:bg-white/[0.05] hover:border-white/10 border border-transparent transition-all cursor-pointer group relative h-[80px]"
          >
            <span className="text-[10px] font-bold text-white/20 w-4 text-center tabular-nums shrink-0 flex items-center justify-center">{i + 1}</span>
            <div className="w-[40px] h-full rounded-lg overflow-hidden shrink-0 border border-white/5 bg-white/[0.02] flex items-center justify-center relative">
              {coverUrl ? (
                <img src={coverUrl} alt={m.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/15" />
                </div>
              )}
              {rating && (
                <div
                  className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border border-black/40 text-white"
                  style={{ backgroundColor: ratingColor, boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                >
                  {rating}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
              <h4 className="text-xs font-bold text-white truncate leading-snug group-hover:text-primary transition-colors" title={m.title}>
                {m.title}
              </h4>
              {creators.length > 0 && (
                <div className="flex items-center gap-1 mt-1 min-w-0 overflow-hidden">
                  {creators.slice(0, 2).map((cName, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-white/8 border border-white/12 text-white/85 min-w-0 overflow-hidden"
                    >
                      <span className="truncate">{cName}</span>
                    </span>
                  ))}
                  {creators.length > 2 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-white/50 bg-white/5 border border-white/10 whitespace-nowrap shrink-0">
                      +{creators.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
              {coll && (
                <span
                  className="inline-flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5"
                  style={{ color: collColor }}
                >
                  <Icon className="w-2 h-2" />
                  {coll.name}
                </span>
              )}
              {statusLabel && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide whitespace-nowrap"
                  style={{ color: statusColor ?? undefined, background: `${statusColor}22`, border: `1px solid ${statusColor}55` }}
                >
                  {statusLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ================================================================== */
/*  Activity Drill-Down Chart (year → month → day)                     */
/* ================================================================== */
type DrillLevel = 'year' | 'month' | 'day';

const ActivityDrillDownChart: React.FC<{
  media: Media[];
  barColor?: string;
  height?: number;
  onPeriodChange?: (p: PeriodFilter) => void;
}> = ({ media, barColor = '#8B5CF6', height = 180, onPeriodChange }) => {
  const { t } = useTranslation();
  const [level, setLevel] = useState<DrillLevel>('year');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const completedMedia = useMemo(() => {
    return media.filter(m => getProgressStatus(m) === 'COMPLETED');
  }, [media]);

  // Yearly data
  const yearlyData = useMemo(() => {
    const map: Record<number, number> = {};
    completedMedia.forEach(m => {
      const dateStr = m.experience_date || m.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      map[d.getFullYear()] = (map[d.getFullYear()] || 0) + 1;
    });
    return Object.keys(map)
      .map(Number)
      .sort((a, b) => a - b)
      .map(year => ({ label: String(year), value: map[year], id: year }));
  }, [completedMedia]);

  // Monthly data for a given year
  const monthlyData = useMemo(() => {
    if (selectedYear === null) return [];
    const map: Record<number, number> = {};
    completedMedia.forEach(m => {
      const dateStr = m.experience_date || m.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== selectedYear) return;
      map[d.getMonth()] = (map[d.getMonth()] || 0) + 1;
    });
    return MONTHS_SHORT.map((label, i) => ({
      label,
      value: map[i] || 0,
      id: i,
      fullLabel: MONTHS_FR[i],
    }));
  }, [completedMedia, selectedYear]);

  // Daily data for a given year + month
  const dailyData = useMemo(() => {
    if (selectedYear === null || selectedMonth === null) return [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const map: Record<number, number> = {};
    completedMedia.forEach(m => {
      const dateStr = m.experience_date || m.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() !== selectedYear || d.getMonth() !== selectedMonth) return;
      map[d.getDate()] = (map[d.getDate()] || 0) + 1;
    });
    const result: { label: string; value: number; id: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({ label: String(day), value: map[day] || 0, id: day });
    }
    return result;
  }, [completedMedia, selectedYear, selectedMonth]);

  const currentData = level === 'year' ? yearlyData : level === 'month' ? monthlyData : dailyData;
  const max = Math.max(...currentData.map(d => d.value), 1);
  const barWidth = Math.max(8, Math.min(40, 600 / Math.max(currentData.length, 1) - 4));

  const handleBarClick = (item: { id: number }) => {
    if (level === 'year') {
      setSelectedYear(item.id);
      setLevel('month');
      onPeriodChange?.({ type: 'year', year: item.id });
    } else if (level === 'month') {
      setSelectedMonth(item.id);
      setLevel('day');
      onPeriodChange?.({ type: 'month', year: selectedYear!, month: item.id });
    }
  };

  const goBack = () => {
    if (level === 'day') {
      setLevel('month');
      setSelectedMonth(null);
      onPeriodChange?.({ type: 'year', year: selectedYear! });
    } else if (level === 'month') {
      setLevel('year');
      setSelectedYear(null);
      onPeriodChange?.({ type: 'all' });
    }
  };

  const breadcrumb = level === 'year' ? null
    : level === 'month' ? (
      <div className="flex items-center gap-2 text-xs">
        <button onClick={goBack} className="text-white/30 hover:text-white transition-colors cursor-pointer">{t('stats.allYears')}</button>
        <span className="text-white/20">/</span>
        <span className="text-white font-medium">{selectedYear}</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-xs">
        <button onClick={() => { setLevel('year'); setSelectedYear(null); setSelectedMonth(null); onPeriodChange?.({ type: 'all' }); }} className="text-white/30 hover:text-white transition-colors cursor-pointer">{t('stats.allYears')}</button>
        <span className="text-white/20">/</span>
        <button onClick={() => { setLevel('month'); setSelectedMonth(null); onPeriodChange?.({ type: 'year', year: selectedYear! }); }} className="text-white/40 hover:text-white transition-colors cursor-pointer">{selectedYear}</button>
        <span className="text-white/20">/</span>
        <span className="text-white font-medium">{MONTHS_FR[selectedMonth!]}</span>
      </div>
    );

  if (yearlyData.length === 0) {
    return <p className="text-xs text-white/20 text-center py-8">{i18next.t('stats.noCompletedThisPeriod')}</p>;
  }

  return (
    <div>
      {breadcrumb && (
        <div className="mb-3">{breadcrumb}</div>
      )}
      <div className="w-full overflow-x-auto custom-scrollbar">
        <div className="flex items-end gap-1 justify-center" style={{ minHeight: height, minWidth: currentData.length * (barWidth + 4) }}>
          {currentData.map((d, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 group cursor-pointer"
              style={{ width: barWidth }}
              onClick={() => level !== 'day' && handleBarClick(d)}
            >
              <span className="text-[9px] text-white/40 font-medium tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                {d.value}
              </span>
              <div
                className="w-full rounded-t-sm transition-all duration-500 group-hover:brightness-125"
                style={{
                  height: `${Math.max((d.value / max) * (height - 30), d.value > 0 ? 3 : 1)}px`,
                  background: `linear-gradient(to top, ${barColor}, ${barColor}bb)`,
                  boxShadow: d.value > 0 ? `0 0 6px ${barColor}25` : 'none',
                }}
                title={`${d.label}: ${d.value}`}
              />
              <span className="text-[8px] text-white/25 font-medium whitespace-nowrap">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      {level === 'year' && (
        <p className="text-[10px] text-white/20 mt-2 text-center">{i18next.t('stats.clickYearHint')}</p>
      )}
      {level === 'month' && (
        <p className="text-[10px] text-white/20 mt-2 text-center">{i18next.t('stats.clickMonthHint')}</p>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Stats Page                                                         */
/* ================================================================== */
const Stats: React.FC = () => {
  const { t } = useTranslation();
  const { data: collections = [] } = useCollections();
  const { data: allMedia = [] } = useMedia();
  const { data: stats } = useDashboardStats();
  const { data: objectives = [] } = useObjectives();

  const [period, setPeriod] = useState<PeriodFilter>({ type: 'all' });
  const [selectedCollections, setSelectedCollections] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<ProgressStatus[]>([]);

  // Collection map
  const collMap = useMemo(() => {
    const m: Record<number, Collection> = {};
    collections.forEach(c => m[c.id] = c);
    return m;
  }, [collections]);

  // Media filtered by period only
  const periodFilteredMedia = useMemo(() => {
    return filterMediaByPeriod(allMedia, period);
  }, [allMedia, period]);

  // Media for status donut: period + collection filter (no status filter so donut shows all statuses)
  const mediaForStatusDonut = useMemo(() => {
    let m = periodFilteredMedia;
    if (selectedCollections.length > 0) {
      m = m.filter(x => x.collection_id !== null && selectedCollections.includes(x.collection_id));
    }
    return m;
  }, [periodFilteredMedia, selectedCollections]);

  // Media for collection donut: period + status filter (no collection filter so donut shows all collections)
  const mediaForCollectionDonut = useMemo(() => {
    let m = periodFilteredMedia;
    if (selectedStatuses.length > 0) {
      m = m.filter(x => selectedStatuses.includes(getProgressStatus(x)));
    }
    return m;
  }, [periodFilteredMedia, selectedStatuses]);

  // Media for activity drill-down chart: collection + status filter but NOT period
  // (the chart manages its own internal year/month/day drill-down)
  const mediaForActivityChart = useMemo(() => {
    let m = allMedia;
    if (selectedCollections.length > 0) {
      m = m.filter(x => x.collection_id !== null && selectedCollections.includes(x.collection_id));
    }
    if (selectedStatuses.length > 0) {
      m = m.filter(x => selectedStatuses.includes(getProgressStatus(x)));
    }
    return m;
  }, [allMedia, selectedCollections, selectedStatuses]);

  // Fully filtered media (period + collections + statuses) — used by all other charts
  const filteredMedia = useMemo(() => {
    let m = periodFilteredMedia;
    if (selectedCollections.length > 0) {
      m = m.filter(x => x.collection_id !== null && selectedCollections.includes(x.collection_id));
    }
    if (selectedStatuses.length > 0) {
      m = m.filter(x => selectedStatuses.includes(getProgressStatus(x)));
    }
    return m;
  }, [periodFilteredMedia, selectedCollections, selectedStatuses]);

  /* -------------------------------- */
  /*  Computed statistics              */
  /* -------------------------------- */

  // Status breakdown (from media without status filter so donut shows all statuses)
  const statusBreakdown = useMemo(() => {
    const counts = { COMPLETED: 0, IN_PROGRESS: 0, NOT_STARTED: 0, ABANDONED: 0 };
    mediaForStatusDonut.forEach(m => {
      const s = getProgressStatus(m);
      counts[s as keyof typeof counts]++;
    });
    return counts;
  }, [mediaForStatusDonut]);

  // Average rating
  const avgRating = useMemo(() => {
    const rated = filteredMedia.filter(m => m.user_rating !== null && m.user_rating > 0);
    if (rated.length === 0) return { avg: 0, count: 0 };
    return { avg: rated.reduce((s, m) => s + m.user_rating!, 0) / rated.length, count: rated.length };
  }, [filteredMedia]);

  // By collection (from media without collection filter so donut shows all collections)
  const byCollection = useMemo(() => {
    const map: Record<number, number> = {};
    mediaForCollectionDonut.forEach(m => {
      if (m.collection_id) map[m.collection_id] = (map[m.collection_id] || 0) + 1;
    });
    return collections
      .map(c => ({ id: c.id, name: c.name, color: c.color, count: map[c.id] || 0, icon: c.icon }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [mediaForCollectionDonut, collections]);

  // Rating distribution (histogram 0-100 in buckets of 5)
  const ratingDistribution = useMemo(() => {
    const buckets: { label: string; value: number; color: string }[] = [];
    for (let i = 0; i <= 95; i += 5) {
      buckets.push({ label: `${i}`, value: 0, color: getRatingColor(i + 2.5) });
    }
    filteredMedia.forEach(m => {
      if (m.user_rating !== null && m.user_rating >= 0) {
        const idx = Math.min(Math.floor(m.user_rating / 5), 19);
        buckets[idx].value++;
      }
    });
    return buckets;
  }, [filteredMedia]);

  // Avg rating per collection
  const avgRatingByCollection = useMemo(() => {
    const map: Record<number, { sum: number; count: number }> = {};
    filteredMedia.forEach(m => {
      if (m.collection_id && m.user_rating !== null && m.user_rating > 0) {
        if (!map[m.collection_id]) map[m.collection_id] = { sum: 0, count: 0 };
        map[m.collection_id].sum += m.user_rating;
        map[m.collection_id].count++;
      }
    });
    return collections
      .filter(c => map[c.id]?.count > 0)
      .map(c => ({
        label: c.name,
        value: Math.round((map[c.id].sum / map[c.id].count) * 10) / 10,
        color: c.color,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredMedia, collections]);

  // Progress stats
  const progressStats = useMemo(() => {
    let totalChapters = 0;
    let totalEpisodes = 0;
    let replayCount = 0;
    let totalReplays = 0;

    filteredMedia.forEach(m => {
      const coll = m.collection_id ? collMap[m.collection_id] : null;
      if (m.progress_current && m.progress_current > 0) {
        const lowerName = (coll?.name || '').toLowerCase();
        if (lowerName.includes('manga') || lowerName.includes('manhwa') || lowerName.includes('livre') || lowerName.includes('book')) {
          totalChapters += m.progress_current;
        } else if (lowerName.includes('série') || lowerName.includes('anime') || lowerName.includes('series')) {
          totalEpisodes += m.progress_current;
        }
      }
      if (m.replay_count != null && m.replay_count > 0) {
        replayCount++;
        totalReplays += m.replay_count;
      }
    });
    return { totalChapters, totalEpisodes, replayCount, totalReplays };
  }, [filteredMedia, collMap]);

  // Seasonality (media per month across all years)
  const seasonality = useMemo(() => {
    const counts = new Array(12).fill(0);
    const finished = filteredMedia.filter(m => getProgressStatus(m) === 'COMPLETED');
    finished.forEach(m => {
      const dateStr = m.experience_date || m.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) counts[d.getMonth()]++;
    });
    return MONTHS_SHORT.map((label, i) => ({ label, value: counts[i] }));
  }, [filteredMedia]);

  // Top genres
  const topGenres = useMemo(() => {
    const map: Record<number, { name: string; color: string; count: number }> = {};
    filteredMedia.forEach(m => {
      if (m.genres) {
        m.genres.forEach((g: Genre) => {
          if (!map[g.id]) map[g.id] = { name: g.name, color: g.color || '#8B5CF6', count: 0 };
          map[g.id].count++;
        });
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [filteredMedia]);

  // Objectives sorted
  const sortedObjectives = useMemo(() => {
    return [...objectives].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
    });
  }, [objectives]);

  // Added this period
  const addedThisPeriod = filteredMedia.length;
  const finishedThisPeriod = filteredMedia.filter(m => getProgressStatus(m) === 'COMPLETED').length;

  return (
    <AppShell>
      <SharedHeader activePage="stats" />
      <MainContent>
        <div className="space-y-6">

          {/* ============================================ */}
          {/* Vue d'ensemble                               */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label={t('stats.media')} value={addedThisPeriod} sub={`${finishedThisPeriod} ${t('stats.finished')}`} icon={BarChart3} color="#3b82f6" />
            <StatCard label={t('stats.avgRating')} value={avgRating.avg > 0 ? avgRating.avg.toFixed(1) : '—'} sub={`${t('stats.basedOn')} ${avgRating.count} ${t('stats.reviews')}`} icon={Star} color="#eab308" />
            <StatCard label={t('stats.thisMonth')} value={stats?.media_this_month ?? 0} sub={t('stats.mediaAdded')} icon={Calendar} color="#22c55e" />
            <StatCard label={t('stats.revisited')} value={progressStats.replayCount} sub={`${progressStats.totalReplays} ${t('stats.rewatch')}`} icon={RotateCcw} color="#8B5CF6" />
          </div>

          {/* ============================================ */}
          {/* Activité dans le temps                       */}
          {/* ============================================ */}
          <Section title={t('stats.activityOverTime')} icon={Flame} iconColor="#f97316">
            <ActivityDrillDownChart media={mediaForActivityChart} barColor="#8B5CF6" height={180} onPeriodChange={setPeriod} />
          </Section>

          {/* ============================================ */}
          {/* Status breakdown + Collection breakdown      */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section
              title={t('stats.statusBreakdown')}
              icon={Eye}
              iconColor="#3b82f6"
              action={selectedStatuses.length > 0 ? (
                <button
                  onClick={() => setSelectedStatuses([])}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-[11px] font-medium transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t('common.all')}
                </button>
              ) : undefined}
            >
              <StatusDonutChart
                size={160}
                strokeWidth={26}
                data={[
                  { id: 'NOT_STARTED', label: getProgressStatusLabel('NOT_STARTED'), shortLabel: 'À', value: statusBreakdown.NOT_STARTED, color: '#818cf8' },
                  { id: 'IN_PROGRESS', label: getProgressStatusLabel('IN_PROGRESS'), shortLabel: 'EN', value: statusBreakdown.IN_PROGRESS, color: '#0ea5e9' },
                  { id: 'ABANDONED', label: getProgressStatusLabel('ABANDONED'), shortLabel: 'ABAND.', value: statusBreakdown.ABANDONED, color: '#f43f5e' },
                  { id: 'COMPLETED', label: getProgressStatusLabel('COMPLETED'), shortLabel: 'TERM.', value: statusBreakdown.COMPLETED, color: '#10b981' },
                ]}
                selectedIds={selectedStatuses}
                onToggleSelect={(id) => {
                  const status = id as ProgressStatus;
                  setSelectedStatuses(prev =>
                    prev.includes(status)
                      ? prev.filter(s => s !== status)
                      : [...prev, status]
                  );
                }}
              />
            </Section>

            <Section
              title={t('stats.collectionBreakdown')}
              icon={Film}
              iconColor="#f59e0b"
              action={selectedCollections.length > 0 ? (
                <button
                  onClick={() => setSelectedCollections([])}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-[11px] font-medium transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t('common.all')}
                </button>
              ) : undefined}
            >
              {byCollection.length > 0 ? (
                <StatusDonutChart
                  size={150}
                  strokeWidth={24}
                  data={byCollection.map(c => ({
                    id: c.id,
                    label: c.name,
                    shortLabel: c.name.slice(0, 8),
                    value: c.count,
                    color: c.color,
                  }))}
                  selectedIds={selectedCollections}
                  onToggleSelect={(id) => {
                    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
                    setSelectedCollections(prev =>
                      prev.includes(numId)
                        ? prev.filter(x => x !== numId)
                        : [...prev, numId]
                    );
                  }}
                />
              ) : (
                <p className="text-xs text-white/20 text-center py-8">{t('stats.noMediaThisPeriod')}</p>
              )}
            </Section>
          </div>

          {/* ============================================ */}
          {/* Notes & évaluations                          */}
          {/* ============================================ */}
          <Section title={t('stats.ratingDistribution')} icon={Star} iconColor="#eab308">
            <VBarChart data={ratingDistribution} height={140} />
            <div className="flex items-center justify-between mt-2 text-[10px] text-white/20 px-1">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section title={t('stats.avgByCollection')} icon={TrendingUp} iconColor="#22c55e" className="lg:col-span-1">
              {avgRatingByCollection.length > 0 ? (
                <HBarChart data={avgRatingByCollection} maxValue={100} />
              ) : (
                <p className="text-xs text-white/20 text-center py-4">{t('stats.noData')}</p>
              )}
            </Section>

            <Section title={t('stats.topRated')} icon={Award} iconColor="#eab308" className="lg:col-span-1">
              <MediaRankList media={filteredMedia} collections={collections} direction="top" />
            </Section>

            <Section title={t('stats.worstRated')} icon={Minus} iconColor="#ef4444" className="lg:col-span-1">
              <MediaRankList media={filteredMedia} collections={collections} direction="bottom" />
            </Section>
          </div>

          {/* ============================================ */}
          {/* Progression & temps                          */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label={t('stats.chaptersRead')} value={progressStats.totalChapters} sub={t('stats.mangaBooks')} icon={BookOpen} color="#f97316" />
            <StatCard label={t('stats.episodesWatched')} value={progressStats.totalEpisodes} sub={t('stats.seriesAnime')} icon={Tv} color="#06b6d4" />
            <StatCard label={t('stats.collections')} value={collections.length} sub={`${allMedia.length} ${t('common.media')}`} icon={Film} color="#8B5CF6" />
            <StatCard label={t('stats.mediaCompleted')} value={finishedThisPeriod} sub={`${t('stats.outOf')} ${addedThisPeriod}`} icon={TrendingUp} color="#22c55e" />
          </div>

          <Section title={t('stats.seasonality')} icon={Calendar} iconColor="#06b6d4">
            <VBarChart data={seasonality} height={120} barColor="#06b6d4" />
            <p className="text-[10px] text-white/20 mt-2 text-center">{t('stats.seasonalityHint')}</p>
          </Section>

          {/* ============================================ */}
          {/* Objectifs                                    */}
          {/* ============================================ */}
          <Section title={t('stats.objectives')} icon={Target} iconColor="#8B5CF6">
            {sortedObjectives.length > 0 ? (
              <div className="flex flex-col gap-5">
                {sortedObjectives.map((obj, idx) => (
                  <React.Fragment key={obj.id}>
                    {idx > 0 && <hr className="border-white/5" />}
                    <ObjectiveCard
                      objective={obj}
                      collection={collMap[obj.collection_id]}
                    />
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/20 text-center py-8">{t('stats.noObjectives')}</p>
            )}
          </Section>

          {/* ============================================ */}
          {/* Genres & Tags                                */}
          {/* ============================================ */}
          <Section title={t('stats.topGenres')} icon={Hash} iconColor="#a855f7">
            {topGenres.length > 0 ? (
              <div className="space-y-4">
                <HBarChart
                  data={topGenres.map(g => ({
                    label: g.name,
                    value: g.count,
                    color: g.color,
                  }))}
                />
                {/* Tag cloud */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                  {topGenres.map(g => (
                    <span
                      key={g.name}
                      className="px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors"
                      style={{
                        color: g.color,
                        borderColor: `${g.color}30`,
                        backgroundColor: `${g.color}10`,
                      }}
                    >
                      {g.name}
                      <span className="ml-1 opacity-50">{g.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/20 text-center py-8">{t('stats.noGenres')}</p>
            )}
          </Section>

        </div>
      </MainContent>
    </AppShell>
  );
};

export default Stats;
