import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import {
  BarChart3, TrendingUp, Star, Calendar, Target, Hash, Flame,
  ChevronDown, Filter, Award, BookOpen, Tv, Film,
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
import { getProgressStatusLabel } from '@/lib/status-labels';
import type { Media, Collection, Genre } from '@/types';

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

function getAvailableYears(media: Media[]): number[] {
  const years = new Set<number>();
  const now = new Date();
  years.add(now.getFullYear());
  media.forEach(m => {
    const d = m.experience_date ? new Date(m.experience_date) : new Date(m.created_at);
    if (!isNaN(d.getTime())) years.add(d.getFullYear());
  });
  return Array.from(years).sort((a, b) => b - a);
}

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
  data: { label: string; value: number; color: string; shortLabel: string }[];
  size?: number;
  strokeWidth?: number;
}> = ({ data, size = 160, strokeWidth = 26 }) => {
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

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

  const centerLabel = activeIdx === -1 ? 'TOTAL' : data[activeIdx]?.shortLabel || data[activeIdx]?.label.split(' ')[0];
  const centerValue = activeIdx === -1 ? total : data[activeIdx]?.value ?? 0;

  return (
    <div className="flex items-center gap-8 flex-wrap" style={{ overflow: 'visible' }}>
      {/* Donut SVG */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, cursor: 'pointer', overflow: 'visible' }}>
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
          const isDimmed = activeIdx !== -1 && !isActive;
          return (
            <path
              key={seg.index}
              d={buildArcPath(seg.startDeg, seg.endDeg, radius, strokeWidth)}
              fill={seg.color}
              opacity={isDimmed ? 0.2 : 1}
              style={{
                transition: 'opacity 0.2s, transform 0.2s',
                transformOrigin: `${size / 2}px ${size / 2}px`,
                transform: isActive ? 'scale(1.07)' : 'scale(1)',
              }}
              onMouseEnter={() => setActiveIdx(seg.index)}
              onMouseLeave={() => setActiveIdx(-1)}
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
          const isDimmed = activeIdx !== -1 && !isActive;
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all border ${
                isActive ? 'bg-white/[0.06] border-white/10' : 'border-transparent hover:bg-white/[0.06] hover:border-white/10'
              }`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(-1)}
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
/*  Period Selector Component                                          */
/* ================================================================== */
const PeriodSelector: React.FC<{
  period: PeriodFilter;
  onChange: (p: PeriodFilter) => void;
  years: number[];
}> = ({ period, onChange, years }) => {
  const [open, setOpen] = useState(false);
  const label = period.type === 'all' ? 'Toute la période'
    : period.type === 'year' ? `${period.year}`
    : period.type === 'month' ? `${MONTHS_FR[period.month!]} ${period.year}`
    : 'Période perso.';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5" />
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#111115] border border-white/10 rounded-xl shadow-2xl z-50 py-1 animate-scale-in">
          <button
            onClick={() => { onChange({ type: 'all' }); setOpen(false); }}
            className={`w-full px-3 py-2 text-xs text-left transition-colors cursor-pointer ${period.type === 'all' ? 'text-primary bg-primary/10' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
          >
            Toute la période
          </button>
          <div className="border-t border-white/5 my-1" />
          {years.map(y => (
            <div key={y}>
              <button
                onClick={() => { onChange({ type: 'year', year: y }); setOpen(false); }}
                className={`w-full px-3 py-2 text-xs text-left transition-colors cursor-pointer flex items-center justify-between ${
                  period.type === 'year' && period.year === y ? 'text-primary bg-primary/10' : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{y}</span>
                <ChevronDown className="w-3 h-3 -rotate-90" />
              </button>
              {(period.type === 'year' || period.type === 'month') && period.year === y && (
                <div className="grid grid-cols-3 gap-0.5 px-2 pb-1">
                  {MONTHS_SHORT.map((m, mi) => (
                    <button
                      key={mi}
                      onClick={() => { onChange({ type: 'month', year: y, month: mi }); setOpen(false); }}
                      className={`px-1 py-1 text-[10px] rounded-md transition-colors cursor-pointer ${
                        period.type === 'month' && period.month === mi ? 'text-primary bg-primary/10' : 'text-white/30 hover:bg-white/5 hover:text-white/60'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Collection Filter Selector                                         */
/* ================================================================== */
const CollectionFilter: React.FC<{
  collections: Collection[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}> = ({ collections, selectedId, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = collections.find(c => c.id === selectedId);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all cursor-pointer"
      >
        <Filter className="w-3.5 h-3.5" />
        {selected ? selected.name : 'Toutes les collections'}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#111115] border border-white/10 rounded-xl shadow-2xl z-50 py-1 animate-scale-in max-h-72 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
              selectedId === null ? 'text-primary bg-primary/10' : 'text-white/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            Toutes les collections
          </button>
          <div className="border-t border-white/5 my-1" />
          {collections.map(c => {
            const Icon = getCollectionIconComponent(c.name, c.icon);
            return (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full px-3 py-2 text-xs text-left transition-colors cursor-pointer flex items-center gap-2 ${
                  selectedId === c.id ? 'text-primary bg-primary/10' : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Top / Bottom media list                                            */
/* ================================================================== */
const MediaRankList: React.FC<{
  media: Media[];
  collections: Collection[];
  direction: 'top' | 'bottom';
}> = ({ media, collections, direction }) => {
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
        return (
          <div key={m.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
            <span className="text-[10px] font-bold text-white/20 w-4 text-center tabular-nums">{i + 1}</span>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${coll?.color || '#8B5CF6'}15` }}>
              <Icon className="w-3 h-3" style={{ color: coll?.color || '#8B5CF6' }} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-white truncate block">{m.title}</span>
              {m.creator && <span className="text-[10px] text-white/30 truncate block">{m.creator.split(';').map(c => c.trim()).filter(Boolean).join(', ')}</span>}
            </div>
            <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: getRatingColor(m.user_rating!) }}>
              {m.user_rating}
            </span>
          </div>
        );
      })}
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
  const [collectionFilter, setCollectionFilter] = useState<number | null>(null);

  const availableYears = useMemo(() => getAvailableYears(allMedia), [allMedia]);

  // Collection map
  const collMap = useMemo(() => {
    const m: Record<number, Collection> = {};
    collections.forEach(c => m[c.id] = c);
    return m;
  }, [collections]);

  // Filtered media
  const filteredMedia = useMemo(() => {
    let m = allMedia;
    if (collectionFilter !== null) m = m.filter(x => x.collection_id === collectionFilter);
    m = filterMediaByPeriod(m, period);
    return m;
  }, [allMedia, period, collectionFilter]);

  /* -------------------------------- */
  /*  Computed statistics              */
  /* -------------------------------- */

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const counts = { COMPLETED: 0, IN_PROGRESS: 0, NOT_STARTED: 0, ABANDONED: 0 };
    filteredMedia.forEach(m => {
      const s = getProgressStatus(m);
      counts[s as keyof typeof counts]++;
    });
    return counts;
  }, [filteredMedia]);

  // Average rating
  const avgRating = useMemo(() => {
    const rated = filteredMedia.filter(m => m.user_rating !== null && m.user_rating > 0);
    if (rated.length === 0) return { avg: 0, count: 0 };
    return { avg: rated.reduce((s, m) => s + m.user_rating!, 0) / rated.length, count: rated.length };
  }, [filteredMedia]);

  // By collection
  const byCollection = useMemo(() => {
    const map: Record<number, number> = {};
    filteredMedia.forEach(m => {
      if (m.collection_id) map[m.collection_id] = (map[m.collection_id] || 0) + 1;
    });
    return collections
      .map(c => ({ id: c.id, name: c.name, color: c.color, count: map[c.id] || 0, icon: c.icon }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [filteredMedia, collections]);

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

  // Activity timeline (media finished per month)
  const timeline = useMemo(() => {
    const map: Record<string, number> = {};
    // Finished media = progress_status === COMPLETED
    const finished = filteredMedia.filter(m => getProgressStatus(m) === 'COMPLETED');
    finished.forEach(m => {
      const dateStr = m.experience_date || m.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + 1;
    });

    // Generate sorted months
    const keys = Object.keys(map).sort();
    if (keys.length === 0) return [];

    // Fill gaps between first and last month
    const start = new Date(keys[0] + '-01');
    const end = new Date(keys[keys.length - 1] + '-01');
    const result: { label: string; value: number; fullLabel: string }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      result.push({
        label: `${MONTHS_SHORT[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(-2)}`,
        value: map[key] || 0,
        fullLabel: `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}`,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }, [filteredMedia]);

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

          {/* Toolbar: Period + Collection filter */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Statistiques
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <CollectionFilter
                collections={collections}
                selectedId={collectionFilter}
                onChange={setCollectionFilter}
              />
              <PeriodSelector
                period={period}
                onChange={setPeriod}
                years={availableYears}
              />
            </div>
          </div>

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
          {/* Status breakdown + Collection breakdown      */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title={t('stats.statusBreakdown')} icon={Eye} iconColor="#3b82f6">
              <StatusDonutChart
                size={160}
                strokeWidth={26}
                data={[
                  { label: getProgressStatusLabel('NOT_STARTED'), shortLabel: 'À', value: statusBreakdown.NOT_STARTED, color: '#818cf8' },
                  { label: getProgressStatusLabel('IN_PROGRESS'), shortLabel: 'EN', value: statusBreakdown.IN_PROGRESS, color: '#0ea5e9' },
                  { label: getProgressStatusLabel('ABANDONED'), shortLabel: 'ABAND.', value: statusBreakdown.ABANDONED, color: '#f43f5e' },
                  { label: getProgressStatusLabel('COMPLETED'), shortLabel: 'TERM.', value: statusBreakdown.COMPLETED, color: '#10b981' },
                ]}
              />
            </Section>

            <Section title={t('stats.collectionBreakdown')} icon={Film} iconColor="#f59e0b">
              {byCollection.length > 0 ? (
                <StatusDonutChart
                  size={150}
                  strokeWidth={24}
                  data={byCollection.map(c => ({
                    label: c.name,
                    shortLabel: c.name.slice(0, 8),
                    value: c.count,
                    color: c.color,
                  }))}
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

          {/* ============================================ */}
          {/* Activité dans le temps                       */}
          {/* ============================================ */}
          <Section title={t('stats.activityOverTime')} icon={Flame} iconColor="#f97316">
            {timeline.length > 0 ? (
              <VBarChart data={timeline} height={160} barColor="#8B5CF6" />
            ) : (
              <p className="text-xs text-white/20 text-center py-8">{t('stats.noCompletedThisPeriod')}</p>
            )}
          </Section>

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
