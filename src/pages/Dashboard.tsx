import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  PlayCircle,
} from 'lucide-react';

import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ContextMenu from '@/components/ContextMenu';
import ConfirmDialog from '@/components/ConfirmDialog';

import { DashboardHero } from '@/components/Dashboard/DashboardHero';
import { MonthlySummaryCard } from '@/components/Dashboard/MonthlySummaryCard';
import { DashboardInProgress } from '@/components/Dashboard/DashboardInProgress';
import { DashboardCollections } from '@/components/Dashboard/DashboardCollections';
import { DashboardObjectiveWidget } from '@/components/Dashboard/DashboardObjectiveWidget';
import { DashboardRecentActivity } from '@/components/Dashboard/DashboardRecentActivity';

import { useTutorialStore } from '@/stores/useTutorialStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useFiltersStore } from '@/stores/useFiltersStore';
import { getProgressStatus } from '@/lib/utils';
import { useCollections } from '@/hooks/useCollections';
import { useUpdateMedia, useDeleteMedia } from '@/hooks/useMedia';
import { useInProgressMedia } from '@/hooks/useDashboardMedia';
import { useDashboardStats } from '@/hooks/useStats';
import { useObjectives, useDeleteObjective } from '@/hooks/useObjectives';
import { useCollectionsMediaCounts, useRecentActivity, useAllMediaWithBackdrops } from '@/hooks/useDashboardExtra';
import type { Media, Collection } from '@/types';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigationStore((s) => s.navigate);
  const navigateToLibrary = useNavigationStore((s) => s.navigateToLibrary);
  const navigateToCollectionEdit = useNavigationStore((s) => s.navigateToCollectionEdit);
  const navigateToMediaCreate = useNavigationStore((s) => s.navigateToMediaCreate);
  const navigateToMediaDetail = useNavigationStore((s) => s.navigateToMediaDetail);
  const navigateToObjectiveCreate = useNavigationStore((s) => s.navigateToObjectiveCreate);
  const navigateToRecentActivity = useNavigationStore((s) => s.navigateToRecentActivity);

  const filterByProgressStatus = useFiltersStore((s) => s.filterByProgressStatus);
  const resetFilters = useFiltersStore((s) => s.resetFilters);

  // Context menu state
  type MediaMenuState = { x: number; y: number; media: Media };
  const [mediaMenu, setMediaMenu] = useState<MediaMenuState | null>(null);
  const [mediaToDelete, setMediaToDelete] = useState<number | null>(null);
  const [objectiveToDelete, setObjectiveToDelete] = useState<number | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, media: Media) => {
    e.preventDefault();
    setMediaMenu({ x: e.clientX, y: e.clientY, media });
  }, []);

  // Mutations
  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();
  const deleteObjectiveMutation = useDeleteObjective();

  const handleMarkCompleted = useCallback((media: Media) => {
    updateMediaMutation.mutate({
      media_id: media.id,
      progress_status: 'COMPLETED',
      progress_current: media.progress_total ?? undefined,
      progress_total: media.progress_total ?? undefined,
    });
  }, [updateMediaMutation]);

  const handleMarkAbandoned = useCallback((media: Media) => {
    updateMediaMutation.mutate({
      media_id: media.id,
      progress_status: 'ABANDONED',
    });
  }, [updateMediaMutation]);

  const handleMarkInProgress = useCallback((media: Media) => {
    const current = media.progress_current ?? 0;
    const total = media.progress_total ?? 1;
    const newCurrent = current === 0 ? 1 : current;
    updateMediaMutation.mutate({
      media_id: media.id,
      progress_status: 'IN_PROGRESS',
      progress_current: newCurrent,
      progress_total: total,
    });
  }, [updateMediaMutation]);

  const handleQuickIncrement = useCallback((media: Media, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = media.progress_current ?? 0;
    const total = media.progress_total ?? null;
    const nextCurrent = current + 1;
    const isCompleted = total !== null && nextCurrent >= total;
    updateMediaMutation.mutate({
      media_id: media.id,
      progress_status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      progress_current: nextCurrent,
      progress_total: total ?? undefined,
    });
  }, [updateMediaMutation]);

  const confirmDeleteMedia = useCallback(async () => {
    if (mediaToDelete === null) return;
    await deleteMediaMutation.mutateAsync(mediaToDelete);
    setMediaToDelete(null);
  }, [mediaToDelete, deleteMediaMutation]);

  const confirmDeleteObjective = useCallback(async () => {
    if (objectiveToDelete === null) return;
    await deleteObjectiveMutation.mutateAsync(objectiveToDelete);
    setObjectiveToDelete(null);
  }, [objectiveToDelete, deleteObjectiveMutation]);

  // Real data hooks
  const { data: collections = [], isLoading: collectionsLoading } = useCollections();
  const { data: inProgressMedia = [], isLoading: inProgressLoading } = useInProgressMedia();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: objectives = [] } = useObjectives();
  const { data: mediaCounts = {} } = useCollectionsMediaCounts(collections);
  const { data: recentActivities = [], isLoading: activitiesLoading } = useRecentActivity(4);
  const { data: allMediaWithBackdrops = [] } = useAllMediaWithBackdrops();

  // Auto-start tutorial on first Dashboard visit after onboarding
  const startTutorial = useTutorialStore((s) => s.startTutorial);
  const tutorialIsActive = useTutorialStore((s) => s.isActive);
  const justFinishedOnboarding = useTutorialStore((s) => s.justFinishedOnboarding);
  const setJustFinishedOnboarding = useTutorialStore((s) => s.setJustFinishedOnboarding);

  useEffect(() => {
    if (justFinishedOnboarding && !tutorialIsActive) {
      const timeout = setTimeout(() => {
        startTutorial();
        setJustFinishedOnboarding(false);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [justFinishedOnboarding, tutorialIsActive, startTutorial, setJustFinishedOnboarding]);

  // Collection map for fast lookups
  const collectionMap = useMemo(() => {
    const map: Record<number, Collection> = {};
    for (const c of collections) map[c.id] = c;
    return map;
  }, [collections]);

  const handleDiscoverLibrary = useCallback(() => {
    resetFilters();
    navigate('library');
  }, [resetFilters, navigate]);

  const handleViewAllInProgress = useCallback(() => {
    filterByProgressStatus('IN_PROGRESS');
    navigate('library');
  }, [filterByProgressStatus, navigate]);

  const handleStartNotStarted = useCallback(() => {
    filterByProgressStatus('NOT_STARTED');
    navigate('library');
  }, [filterByProgressStatus, navigate]);

  const handleStatClick = useCallback((status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ABANDONED' | 'COMPLETED') => {
    filterByProgressStatus(status);
    navigate('library');
  }, [filterByProgressStatus, navigate]);

  const handleViewAllRecent = useCallback(() => {
    navigateToRecentActivity();
  }, [navigateToRecentActivity]);

  return (
    <AppShell>
      <SharedHeader activePage="dashboard" />

      {/* Main Content */}
      <MainContent>
        <div className="space-y-8" data-context-menu-open={!!mediaMenu}>
          
          {/* ── ROW 1: Hero Carousel (Left) + Monthly Summary (Right) — Fixed Height & Perfect Alignment ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Top Left: Backdrop Spotlight Hero */}
            <div className="lg:col-span-2">
              <DashboardHero
                allMediaWithBackdrops={allMediaWithBackdrops}
                collectionMap={collectionMap}
                onMediaClick={navigateToMediaDetail}
                onDiscoverClick={handleDiscoverLibrary}
              />
            </div>

            {/* Top Right: Monthly Summary */}
            <div className="lg:col-span-1">
              <MonthlySummaryCard
                stats={stats}
                isLoading={statsLoading}
                onStatusClick={handleStatClick}
              />
            </div>
          </div>

          {/* ── ROW 2: Reprendre votre progression (Left 65%) + Activité récente (Right 35%) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Left 2 Cols: Reprendre votre progression */}
            <div className="lg:col-span-2 h-full">
              <DashboardInProgress
                mediaList={inProgressMedia}
                notStartedCount={stats?.not_started_count ?? 0}
                collectionMap={collectionMap}
                isLoading={inProgressLoading}
                onMediaClick={navigateToMediaDetail}
                onViewAllClick={handleViewAllInProgress}
                onContextMenu={handleContextMenu}
                onDiscoverClick={handleDiscoverLibrary}
                onStartMedia={handleStartNotStarted}
                onQuickIncrement={handleQuickIncrement}
              />
            </div>

            {/* Right 1 Col: Activité récente */}
            <div className="lg:col-span-1 h-full">
              <DashboardRecentActivity
                activities={recentActivities}
                collectionMap={collectionMap}
                isLoading={activitiesLoading}
                onMediaClick={navigateToMediaDetail}
                onViewAllClick={handleViewAllRecent}
              />
            </div>
          </div>

          {/* ── ROW 3: Collections (Left 66%) + Objectif en cours (Right 33%) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Left 2 Cols: Collections */}
            <div className="lg:col-span-2 h-full" data-tutorial="collections-section">
              <DashboardCollections
                collections={collections}
                mediaCounts={mediaCounts}
                isLoading={collectionsLoading}
                onCollectionClick={navigateToLibrary}
                onManageCollections={() => navigateToCollectionEdit()}
              />
            </div>

            {/* Right 1 Col: Objectif en cours */}
            <div className="lg:col-span-1 h-full">
              <DashboardObjectiveWidget
                objectives={objectives}
                collectionMap={collectionMap}
                onAddObjective={() => navigateToObjectiveCreate()}
                onEditObjective={(id) => navigateToObjectiveCreate(id)}
              />
            </div>
          </div>
        </div>

        {/* ── Context Menu ── */}
        {mediaMenu && (() => {
          const m = mediaMenu.media;
          const status = getProgressStatus(m);
          const items = [
            { label: t('media.viewDetails'), icon: Eye, onClick: () => navigateToMediaDetail(m.id) },
            { label: t('media.edit'), icon: Pencil, onClick: () => navigateToMediaCreate(null, m.id) },
            ...(status !== 'IN_PROGRESS' ? [{ label: t('media.markInProgress'), icon: PlayCircle, onClick: () => handleMarkInProgress(m) }] : []),
            ...(status !== 'COMPLETED' ? [{ label: t('media.markCompleted'), icon: CheckCircle2, onClick: () => handleMarkCompleted(m) }] : []),
            ...(status !== 'ABANDONED' ? [{ label: t('media.markAbandoned'), icon: XCircle, onClick: () => handleMarkAbandoned(m) }] : []),
            { label: t('media.delete'), icon: Trash2, danger: true, onClick: () => setMediaToDelete(m.id) },
          ];
          return (
            <ContextMenu
              x={mediaMenu.x}
              y={mediaMenu.y}
              title={m.title}
              items={items}
              onClose={() => setMediaMenu(null)}
            />
          );
        })()}

        {/* ── Delete Media Dialog ── */}
        <ConfirmDialog
          open={mediaToDelete !== null}
          onClose={() => setMediaToDelete(null)}
          title={t('media.confirmDeleteTitle')}
          description={t('media.confirmDeleteDescription')}
          iconColor="#ef4444"
          actions={[
            { label: t('common.cancel'), onClick: () => setMediaToDelete(null) },
            { label: t('media.delete'), onClick: confirmDeleteMedia, variant: 'danger' },
          ]}
        />

        {/* ── Delete Objective Dialog ── */}
        <ConfirmDialog
          open={objectiveToDelete !== null}
          onClose={() => setObjectiveToDelete(null)}
          title={t('dashboard.deleteObjective')}
          description={t('dashboard.deleteObjectiveDescription')}
          icon={Trash2}
          iconColor="#ef4444"
          actions={[
            {
              label: t('dashboard.delete'),
              variant: 'danger',
              icon: Trash2,
              onClick: confirmDeleteObjective,
            },
          ]}
        />
      </MainContent>
    </AppShell>
  );
};

export default Dashboard;