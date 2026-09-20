import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  ArrowLeft,
  Clock,
  Search,
  X,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  XCircle,
  PlusCircle,
  Star,
  Film,
  Filter,
  Layers,
  Calendar,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useCollections } from '@/hooks/useCollections';
import { useRecentActivity, type ActivityItem } from '@/hooks/useDashboardExtra';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { formatDateFr } from '@/lib/utils';
import { Pagination } from '@/components/Pagination';
import type { Collection } from '@/types';

type StatusFilter = 'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'ON_HOLD' | 'ABANDONED' | 'ADDED';

interface GroupedActivities {
  key: string;
  label: string;
  items: ActivityItem[];
}

const PAGE_SIZE = 40;

function getItemDate(item: ActivityItem): Date {
  if (item.experienceDate) {
    try {
      return new Date(item.experienceDate);
    } catch {
      // fallback
    }
  }
  return new Date(item.updatedAt || item.createdAt);
}

function formatRelativeTime(item: ActivityItem, t: any): string {
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
    const date = new Date(item.updatedAt || item.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return t('dashboard.justNow');
    if (diffHours < 1) return t('dashboard.minutesAgo', { count: Math.max(1, diffMins) });
    if (diffHours < 24) return t('dashboard.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('dashboard.daysAgo', { count: diffDays });
    return formatDateFr(item.updatedAt || item.createdAt);
  } catch {
    return '';
  }
}

export const RecentActivity: React.FC = () => {
  const { t } = useTranslation();
  const goBack = useNavigationStore((s) => s.goBack);
  const navigateToMediaDetail = useNavigationStore((s) => s.navigateToMediaDetail);
  const navigate = useNavigationStore((s) => s.navigate);

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('ALL');
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Load up to 300 recent activities (fast in SQLite, and paginated client-side for smooth 60fps rendering)
  const { data: activities = [], isLoading: activitiesLoading } = useRecentActivity(300);
  const { data: collections = [] } = useCollections();

  const collectionMap = useMemo(() => {
    const map: Record<number, Collection> = {};
    for (const c of collections) {
      map[c.id] = c;
    }
    return map;
  }, [collections]);

  // Activity counts per collection
  const collectionCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const a of activities) {
      if (a.collectionId) {
        counts[a.collectionId] = (counts[a.collectionId] || 0) + 1;
      }
    }
    return counts;
  }, [activities]);

  // Overall statistics
  const stats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let onHold = 0;
    let added = 0;

    for (const a of activities) {
      if (a.status === 'COMPLETED') completed++;
      else if (a.status === 'IN_PROGRESS') inProgress++;
      else if (a.status === 'ON_HOLD') onHold++;
      else if (a.status === 'ADDED' || a.status === 'NOT_STARTED') added++;
    }

    return {
      total: activities.length,
      completed,
      inProgress,
      onHold,
      added,
    };
  }, [activities]);

  // Reset pagination whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedStatus, selectedCollectionId]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      // Collection filter
      if (selectedCollectionId !== 'ALL' && item.collectionId !== selectedCollectionId) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'ADDED') {
          if (item.status !== 'ADDED' && item.status !== 'NOT_STARTED') return false;
        } else if (item.status !== selectedStatus) {
          return false;
        }
      }

      // Search query
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(query);
        const creatorMatch = item.creator ? item.creator.toLowerCase().includes(query) : false;
        if (!titleMatch && !creatorMatch) return false;
      }

      return true;
    });
  }, [activities, selectedCollectionId, selectedStatus, search]);

  // Pagination calculation
  const totalItems = filteredActivities.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, currentPage]);

  // Chronological grouping on the paginated slice
  const groupedActivities = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 6 * 86400000;
    const monthStart = todayStart - 29 * 86400000;

    const todayItems: ActivityItem[] = [];
    const yesterdayItems: ActivityItem[] = [];
    const thisWeekItems: ActivityItem[] = [];
    const thisMonthItems: ActivityItem[] = [];
    const olderItems: ActivityItem[] = [];

    for (const item of paginatedActivities) {
      const itemTime = getItemDate(item).getTime();
      if (itemTime >= todayStart) {
        todayItems.push(item);
      } else if (itemTime >= yesterdayStart) {
        yesterdayItems.push(item);
      } else if (itemTime >= weekStart) {
        thisWeekItems.push(item);
      } else if (itemTime >= monthStart) {
        thisMonthItems.push(item);
      } else {
        olderItems.push(item);
      }
    }

    const groups: GroupedActivities[] = [];
    if (todayItems.length > 0) {
      groups.push({ key: 'today', label: t('recentActivityPage.groups.today'), items: todayItems });
    }
    if (yesterdayItems.length > 0) {
      groups.push({ key: 'yesterday', label: t('recentActivityPage.groups.yesterday'), items: yesterdayItems });
    }
    if (thisWeekItems.length > 0) {
      groups.push({ key: 'thisWeek', label: t('recentActivityPage.groups.thisWeek'), items: thisWeekItems });
    }
    if (thisMonthItems.length > 0) {
      groups.push({ key: 'thisMonth', label: t('recentActivityPage.groups.thisMonth'), items: thisMonthItems });
    }
    if (olderItems.length > 0) {
      groups.push({ key: 'older', label: t('recentActivityPage.groups.older'), items: olderItems });
    }

    return groups;
  }, [paginatedActivities, t]);

  const hasActiveFilters = search.trim() !== '' || selectedStatus !== 'ALL' || selectedCollectionId !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setSelectedStatus('ALL');
    setSelectedCollectionId('ALL');
  };

  const statusOptions: { id: StatusFilter; label: string; icon: LucideIcon; color: string }[] = [
    { id: 'ALL', label: t('recentActivityPage.allStatuses'), icon: Filter, color: '#94a3b8' },
    { id: 'COMPLETED', label: t('recentActivityPage.status.COMPLETED'), icon: CheckCircle2, color: '#10b981' },
    { id: 'IN_PROGRESS', label: t('recentActivityPage.status.IN_PROGRESS'), icon: PlayCircle, color: '#38bdf8' },
    { id: 'ON_HOLD', label: t('recentActivityPage.status.ON_HOLD'), icon: PauseCircle, color: '#fbbf24' },
    { id: 'ABANDONED', label: t('recentActivityPage.status.ABANDONED'), icon: XCircle, color: '#f43f5e' },
    { id: 'ADDED', label: t('recentActivityPage.status.ADDED'), icon: PlusCircle, color: '#818cf8' },
  ];

  return (
    <AppShell>
      <SharedHeader activePage="recent-activity" />
      <MainContent>
        <div className="space-y-6 pb-12">
          {/* Top Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={goBack}
                aria-label={t('recentActivityPage.backToDashboard')}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {t('recentActivityPage.title')}
                  </h1>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/75 border border-white/10">
                    {filteredActivities.length}
                  </span>
                </div>
                <p className="text-xs text-white/50 hidden sm:block">
                  {t('recentActivityPage.subtitle')}
                </p>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="self-start sm:self-center text-xs font-medium text-primary hover:text-primary-light flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                {t('recentActivityPage.resetFilters')}
              </button>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card p-3.5 rounded-xl border border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/70">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 font-medium">{t('recentActivityPage.statTotal')}</p>
                <p className="text-lg font-bold text-white leading-tight">{stats.total}</p>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 font-medium">{t('recentActivityPage.statCompleted')}</p>
                <p className="text-lg font-bold text-white leading-tight">{stats.completed}</p>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                <PlayCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 font-medium">{t('recentActivityPage.statInProgress')}</p>
                <p className="text-lg font-bold text-white leading-tight">{stats.inProgress}</p>
              </div>
            </div>

            <div className="glass-card p-3.5 rounded-xl border border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <PlusCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] text-white/40 font-medium">{t('recentActivityPage.statAdded')}</p>
                <p className="text-lg font-bold text-white leading-tight">{stats.added}</p>
              </div>
            </div>
          </div>

          {/* Collection Pills Bar */}
          {collections.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {/* All Collections pill */}
              <button
                type="button"
                onClick={() => setSelectedCollectionId('ALL')}
                className={`shrink-0 flex items-center gap-2 h-9 rounded-xl px-3.5 text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                  selectedCollectionId === 'ALL'
                    ? 'bg-white/15 border-white/25 text-white shadow-sm'
                    : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t('recentActivityPage.allCollections')}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-white/70 font-mono">
                  {activities.length}
                </span>
              </button>

              {/* Individual Collection pills */}
              {collections.map((coll) => {
                const isSelected = selectedCollectionId === coll.id;
                const CollIcon = getCollectionIconComponent(coll.name, coll.icon);
                const color = coll.color || '#8B5CF6';
                const count = collectionCounts[coll.id] || 0;

                return (
                  <button
                    key={coll.id}
                    type="button"
                    onClick={() => setSelectedCollectionId(coll.id)}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${color}25`,
                            borderColor: `${color}70`,
                            boxShadow: `0 0 14px ${color}30`,
                            color: '#ffffff',
                          }
                        : undefined
                    }
                    className={`shrink-0 flex items-center gap-2 h-9 rounded-xl px-3.5 text-xs font-semibold border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-transparent text-white'
                        : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    <CollIcon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: isSelected ? color : `${color}cc` }}
                    />
                    <span>{coll.name}</span>
                    {count > 0 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md font-mono"
                        style={{
                          backgroundColor: isSelected ? `${color}35` : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search & Status Filter Controls */}
          <div className="glass-card p-4 rounded-2xl border border-white/10 shadow-xl space-y-3.5">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('recentActivityPage.searchPlaceholder')}
                className="w-full pl-10 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {statusOptions.map((opt) => {
                const isSelected = selectedStatus === opt.id;
                const IconComponent = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedStatus(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 text-white shadow-sm border border-white/20'
                        : 'bg-white/[0.03] text-white/50 hover:bg-white/[0.07] hover:text-white/80 border border-white/[0.05]'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" style={{ color: opt.color }} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activities Content */}
          {activitiesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((g) => (
                <div key={g} className="glass-card p-5 rounded-2xl border border-white/10 space-y-3">
                  <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-4 items-center p-3 rounded-xl bg-white/5 animate-pulse">
                        <div className="w-12 h-16 rounded-lg bg-white/10 shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-white/10 rounded w-1/2" />
                          <div className="h-3 bg-white/5 rounded w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            /* Empty State: No activities at all */
            <div className="glass-card p-12 rounded-2xl border border-white/10 text-center space-y-4 max-w-md mx-auto my-8">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  {t('recentActivityPage.noActivities')}
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  {t('recentActivityPage.noActivitiesEver')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('library')}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-xs font-semibold text-white transition-all cursor-pointer"
              >
                {t('dashboard.discoverLibrary')}
              </button>
            </div>
          ) : filteredActivities.length === 0 ? (
            /* Empty State: No matches for search / filter */
            <div className="glass-card p-10 rounded-2xl border border-white/10 text-center space-y-3 max-w-md mx-auto my-8">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/40">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {t('recentActivityPage.noActivities')}
              </h3>
              <p className="text-xs text-white/40">
                {t('recentActivityPage.noActivitiesDesc')}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                {t('recentActivityPage.resetFilters')}
              </button>
            </div>
          ) : (
            /* Chronological Feed */
            <div className="space-y-6">
              {groupedActivities.map((group) => (
                <div key={group.key} className="space-y-3">
                  {/* Group header pill */}
                  <div className="flex items-center gap-2 px-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-white/70">
                      {group.label}
                    </h2>
                    <span className="text-[11px] text-white/30 font-medium">
                      ({group.items.length})
                    </span>
                    <div className="flex-1 h-px bg-white/10 ml-2" />
                  </div>

                  {/* List of cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.items.map((item) => {
                      const collection = item.collectionId ? collectionMap[item.collectionId] : null;
                      const CollectionIcon = collection
                        ? getCollectionIconComponent(collection.name, collection.icon)
                        : Film;
                      const coverSrc = item.coverImage
                        ? `${convertFileSrc(item.coverImage)}?t=${item.updatedAt}`
                        : null;

                      const timeText = formatRelativeTime(item, t);
                      const preciseDate = formatDateFr(item.experienceDate || item.updatedAt || item.createdAt);

                      let detailLabel = t('recentActivityPage.status.ADDED');
                      let StatusIcon = PlusCircle;
                      let iconColor = '#818cf8';

                      if (item.status === 'COMPLETED') {
                        detailLabel = t('recentActivityPage.status.COMPLETED');
                        StatusIcon = CheckCircle2;
                        iconColor = '#10b981';
                      } else if (item.status === 'IN_PROGRESS') {
                        StatusIcon = PlayCircle;
                        iconColor = '#38bdf8';
                        if (item.progressCurrent != null && item.progressCurrent > 0) {
                          detailLabel = `${t('dashboard.progressOf') || 'Progression'} : ${item.progressCurrent}${
                            item.progressTotal ? ` / ${item.progressTotal}` : ''
                          }`;
                        } else {
                          detailLabel = t('recentActivityPage.status.IN_PROGRESS');
                        }
                      } else if (item.status === 'ON_HOLD') {
                        detailLabel = t('recentActivityPage.status.ON_HOLD');
                        StatusIcon = PauseCircle;
                        iconColor = '#fbbf24';
                      } else if (item.status === 'ABANDONED') {
                        detailLabel = t('recentActivityPage.status.ABANDONED');
                        StatusIcon = XCircle;
                        iconColor = '#f43f5e';
                      }

                      const progressPercent =
                        item.progressCurrent && item.progressTotal && item.progressTotal > 0
                          ? Math.min(100, Math.round((item.progressCurrent / item.progressTotal) * 100))
                          : null;

                      return (
                        <div
                          key={item.id}
                          onClick={() => navigateToMediaDetail(item.mediaId)}
                          className="glass-card p-3 sm:p-4 rounded-xl border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200 cursor-pointer group flex gap-3.5 items-center relative overflow-hidden shadow-sm hover:shadow-lg"
                        >
                          {/* Poster thumbnail */}
                          <div className="w-14 h-20 sm:w-16 sm:h-22 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 relative group-hover:border-primary/40 transition-colors shadow">
                            {coverSrc ? (
                              <img
                                src={coverSrc}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-white/5 text-[10px] text-white/25 font-bold">
                                LOGIA
                              </div>
                            )}
                          </div>

                          {/* Info Column */}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Top row: Status & Timestamp */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <StatusIcon className="w-3.5 h-3.5 shrink-0" style={{ color: iconColor }} />
                                <span className="text-xs font-semibold truncate" style={{ color: iconColor }}>
                                  {detailLabel}
                                </span>
                              </div>

                              <span className="text-[11px] text-white/40 shrink-0 font-medium" title={preciseDate}>
                                {timeText}
                              </span>
                            </div>

                            {/* Media Title */}
                            <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                              {item.title}
                            </h3>

                            {/* Subtitle: Creator + Collection Badge + Rating */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {collection && (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border"
                                  style={{
                                    backgroundColor: collection.color ? `${collection.color}20` : '#ffffff10',
                                    borderColor: collection.color ? `${collection.color}40` : '#ffffff20',
                                    color: collection.color || '#ffffff',
                                  }}
                                >
                                  <CollectionIcon className="w-3 h-3" />
                                  {collection.name}
                                </span>
                              )}

                              {item.creator && (
                                <span className="text-xs text-white/50 truncate max-w-[150px]">
                                  {item.creator}
                                </span>
                              )}

                              {item.rating != null && item.rating > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                                  <Star className="w-3 h-3 fill-amber-400" />
                                  {item.rating}
                                </span>
                              )}
                            </div>

                            {/* Progress bar if in progress and has total */}
                            {progressPercent != null && (
                              <div className="pt-1">
                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-sky-400 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Hover action icon */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 group-hover:text-primary pr-1 hidden sm:block">
                            <ExternalLink className="w-4 h-4" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="pt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageStart={(currentPage - 1) * PAGE_SIZE + 1}
                    pageEnd={Math.min(totalItems, currentPage * PAGE_SIZE)}
                    onPageChange={(page) => {
                      setCurrentPage(page);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </MainContent>
    </AppShell>
  );
};

export default RecentActivity;
