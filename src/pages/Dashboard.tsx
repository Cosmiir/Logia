import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, 
  PlayCircle, 
  FolderOpen, 
  Plus,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Target,
} from 'lucide-react';

import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import { MediaCarousel } from '@/components/MediaCarousel';
import { MemoizedMediaCard as MediaCard, getCollectionColor } from '@/components/MediaCard';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { MediaCardSkeleton } from '@/components/MediaCardSkeleton';
import ContextMenu from '@/components/ContextMenu';
import ConfirmDialog from '@/components/ConfirmDialog';
import ObjectiveCard from '@/components/ObjectiveCard';
import { UnifiedStatsCard } from '@/components/UnifiedStatsCard';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { getProgressStatus } from '@/lib/utils';
import { useCollections } from '@/hooks/useCollections';
import { useUpdateMedia, useDeleteMedia } from '@/hooks/useMedia';
import { useInProgressMedia, useRecentMedia } from '@/hooks/useDashboardMedia';
import { useDashboardStats } from '@/hooks/useStats';
import { useObjectives, useDeleteObjective } from '@/hooks/useObjectives';
import type { Media, Collection } from '@/types';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigateToLibrary = useNavigationStore((s) => s.navigateToLibrary);
  const navigateToCollectionEdit = useNavigationStore((s) => s.navigateToCollectionEdit);
  const navigateToMediaCreate = useNavigationStore((s) => s.navigateToMediaCreate);
  const navigateToMediaDetail = useNavigationStore((s) => s.navigateToMediaDetail);
  
  // Context menu state
  type MediaMenuState = { x: number; y: number; media: Media };
  const [mediaMenu, setMediaMenu] = useState<MediaMenuState | null>(null);
  const [mediaToDelete, setMediaToDelete] = useState<number | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, media: Media) => {
    e.preventDefault();
    setMediaMenu({ x: e.clientX, y: e.clientY, media });
  }, []);

  // Mutations
  const updateMediaMutation = useUpdateMedia();
  const deleteMediaMutation = useDeleteMedia();

  const handleMarkCompleted = useCallback((media: Media) => {
    updateMediaMutation.mutate({ media_id: media.id, progress_status: 'COMPLETED', progress_current: media.progress_total ?? undefined, progress_total: media.progress_total ?? undefined });
  }, [updateMediaMutation]);

  const handleMarkAbandoned = useCallback((media: Media) => {
    updateMediaMutation.mutate({ media_id: media.id, progress_status: 'ABANDONED' });
  }, [updateMediaMutation]);

  const handleMarkInProgress = useCallback((media: Media) => {
    const current = media.progress_current ?? 0;
    const total = media.progress_total ?? 1;
    const newCurrent = current === 0 ? 1 : current;
    updateMediaMutation.mutate({ media_id: media.id, progress_status: 'IN_PROGRESS', progress_current: newCurrent, progress_total: total });
  }, [updateMediaMutation]);

  const confirmDeleteMedia = useCallback(async () => {
    if (mediaToDelete === null) return;
    await deleteMediaMutation.mutateAsync(mediaToDelete);
    setMediaToDelete(null);
  }, [mediaToDelete, deleteMediaMutation]);

  // Objectives state
  const navigateToObjectiveCreate = useNavigationStore((s) => s.navigateToObjectiveCreate);
  const [objectiveToDelete, setObjectiveToDelete] = useState<number | null>(null);

  // Real data hooks - optimisés pour le dashboard avec limites
  const { data: collections = [], isLoading: collectionsLoading } = useCollections();
  const { data: inProgressMedia = [], isLoading: inProgressLoading } = useInProgressMedia();
  const { data: recentAdditions = [], isLoading: recentLoading } = useRecentMedia();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: objectives = [] } = useObjectives();
  const deleteObjectiveMutation = useDeleteObjective();

  const confirmDeleteObjective = useCallback(async () => {
    if (objectiveToDelete === null) return;
    await deleteObjectiveMutation.mutateAsync(objectiveToDelete);
    setObjectiveToDelete(null);
  }, [objectiveToDelete, deleteObjectiveMutation]);

  // Sort objectives: active first, then by end_date ASC
  const sortedObjectives = useMemo(() => {
    return [...objectives].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
    });
  }, [objectives]);

  const isLoading = collectionsLoading || inProgressLoading || recentLoading || statsLoading;

  const collectionMap = useMemo(() => {
    const map: Record<number, Collection> = {};
    for (const c of collections) map[c.id] = c;
    return map;
  }, [collections]);

  const getCollName = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.name ?? '' : '';
  const getCollIcon = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.icon ?? null : null;
  const getCollColor = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.color : undefined;
  const getCollProgressionLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.progression_label : undefined;
  const getCollProgressionShortLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.progression_short_label ?? undefined : undefined;
  const getCollPluralWithS = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.plural_with_s ?? false : false;
  const getCollCreatorLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.creator_label : undefined;
  const getCollExperienceDateLabel = (collectionId: number | null) => collectionId ? collectionMap[collectionId]?.date_label : undefined;

  // Stable callbacks for carousel cards — avoid creating inline functions per card
  const handleStableCardClick = useCallback((e?: React.MouseEvent) => {
    const target = e?.target as HTMLElement;
    const cardDiv = target?.closest('[data-media-id]') as HTMLElement | null;
    const mediaId = cardDiv?.dataset.mediaId;
    if (mediaId) navigateToMediaDetail(Number(mediaId));
  }, [navigateToMediaDetail]);

  const handleStableCardContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const cardDiv = target?.closest('[data-media-id]') as HTMLElement | null;
    const mediaId = cardDiv?.dataset.mediaId;
    if (mediaId) {
      const m = [...inProgressMedia, ...recentAdditions].find(item => item.id === Number(mediaId));
      if (m) handleContextMenu(e, m);
    }
  }, [inProgressMedia, recentAdditions, handleContextMenu]);


  return (
    <AppShell>
      <SharedHeader activePage="dashboard" />

      {/* Main Content */}
      <MainContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-context-menu-open={!!mediaMenu}>
          {/* Colonne gauche */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Card */}
            <UnifiedStatsCard stats={stats} isLoading={isLoading} />

            {/* En cours */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlayCircle className="w-6 h-6 text-flashy-purple" />
                  {t('dashboard.inProgress')}
                </h2>
              </div>
              <div className="glass-card rounded-xl p-6">
                {isLoading ? (
                  <MediaCarousel isLoading>
                    <MediaCardSkeleton count={6} />
                  </MediaCarousel>
                ) : inProgressMedia.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-8">{t('dashboard.noInProgress')}</p>
                ) : (
                  <MediaCarousel>
                    {inProgressMedia.map((media: Media) => (
                      <div key={media.id} data-media-id={media.id}>
                        <MediaCard
                          media={media}
                          collectionName={getCollName(media.collection_id)}
                          collectionIcon={getCollIcon(media.collection_id)}
                          collectionColor={getCollColor(media.collection_id)}
                          progressionLabel={getCollProgressionLabel(media.collection_id)}
                          progressionShortLabel={getCollProgressionShortLabel(media.collection_id)}
                          pluralWithS={getCollPluralWithS(media.collection_id)}
                          creatorLabel={getCollCreatorLabel(media.collection_id)}
                          experienceDateLabel={getCollExperienceDateLabel(media.collection_id)}
                          onContextMenu={handleStableCardContextMenu}
                          onClick={handleStableCardClick}
                        />
                      </div>
                    ))}
                  </MediaCarousel>
                )}
              </div>
            </div>

            {/* Derniers ajouts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-flashy-blue" />
                  {t('dashboard.recentAdditions')}
                </h2>
              </div>
              <div className="glass-card rounded-xl p-6">
                {isLoading ? (
                  <MediaCarousel isLoading>
                    <MediaCardSkeleton count={6} />
                  </MediaCarousel>
                ) : recentAdditions.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-8">{t('dashboard.noRecentAdditions')}</p>
                ) : (
                  <MediaCarousel>
                    {recentAdditions.map((media: Media) => (
                      <div key={media.id} data-media-id={media.id}>
                        <MediaCard
                          media={media}
                          collectionName={getCollName(media.collection_id)}
                          collectionIcon={getCollIcon(media.collection_id)}
                          collectionColor={getCollColor(media.collection_id)}
                          progressionLabel={getCollProgressionLabel(media.collection_id)}
                          progressionShortLabel={getCollProgressionShortLabel(media.collection_id)}
                          pluralWithS={getCollPluralWithS(media.collection_id)}
                          creatorLabel={getCollCreatorLabel(media.collection_id)}
                          experienceDateLabel={getCollExperienceDateLabel(media.collection_id)}
                          onContextMenu={handleStableCardContextMenu}
                          onClick={handleStableCardClick}
                        />
                      </div>
                    ))}
                  </MediaCarousel>
                )}
              </div>
            </div>
          </div>

          {/* Context Menu */}
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

          {/* Delete confirmation */}
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

          {/* Colonne droite */}
          <div className="lg:col-span-1 space-y-6">
            {/* Collections */}
            <div className="glass-card-opaque rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderOpen className="w-6 h-6 text-flashy-blue" />
                  {t('dashboard.collections')}
                </h2>
                <button
                  onClick={() => navigateToCollectionEdit()}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-text-secondary hover:text-white transition-colors cursor-pointer"
                  title={t('dashboard.newCollection')}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {collections.length === 0 ? (
                <button
                  onClick={() => navigateToCollectionEdit()}
                  className="w-full py-8 flex flex-col items-center gap-2 text-text-secondary hover:text-white transition-colors cursor-pointer"
                >
                  <Plus className="w-8 h-8" />
                  <span className="text-sm">{t('dashboard.createCollection')}</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {collections.map((collection) => {
                    const Icon = getCollectionIconComponent(collection.name, collection.icon);
                    const collColor = collection.color || getCollectionColor(collection.name);
                    return (
                      <button
                        key={collection.id}
                        onClick={() => navigateToLibrary(collection.id)}
                        className="collection-item flex flex-col items-center justify-center p-3 rounded-xl bg-white/5 border border-white/10 transition-all group backdrop-blur-md cursor-pointer"
                        style={{ '--col-color': collColor, '--col-color-20': `${collColor}33`, '--col-color-shadow': `${collColor}26` } as React.CSSProperties}
                      >
                        <Icon className="w-6 h-6 text-gray-400 mb-1 transition-colors" style={{ color: undefined }} />
                        <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">{collection.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Objectifs */}
            <div className="glass-card-opaque rounded-xl p-6 flex flex-col relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex items-center justify-between mb-6 z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Target className="w-6 h-6 text-flashy-purple" />
                  {t('dashboard.objectives')}
                </h2>
                <button
                  onClick={() => navigateToObjectiveCreate()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs font-medium transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('dashboard.addObjective')}
                </button>
              </div>
              
              <div className="flex flex-col gap-5 z-10">
                {sortedObjectives.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-3">
                      <Target className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-sm text-white/40 mb-1">{t('dashboard.noObjective')}</p>
                    <p className="text-xs text-white/25">{t('dashboard.createFirstObjective')}</p>
                  </div>
                ) : (
                  sortedObjectives.map((obj, idx) => (
                    <React.Fragment key={obj.id}>
                      {idx > 0 && <hr className="border-white/5" />}
                      <ObjectiveCard
                        objective={obj}
                        collection={collectionMap[obj.collection_id]}
                        onEdit={() => navigateToObjectiveCreate(obj.id)}
                        onDelete={() => setObjectiveToDelete(obj.id)}
                      />
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>

            {/* Delete Objective Dialog */}
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
          </div>
        </div>
      </MainContent>
    </AppShell>
  );
};

export default Dashboard;
