import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Trash2, Database, HardDrive, Loader2, CheckCircle2, RefreshCw, GitMerge } from 'lucide-react';
import { tauriApi } from '@/lib/tauri-api';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useProfiles, useActiveProfile } from '@/hooks/useProfiles';
import type { StorageInfo } from '@/types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

const GlassActionButton: React.FC<{
  label: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
  state?: ActionState;
  successLabel?: string;
  description?: string;
  variant?: 'primary' | 'danger';
}> = ({ label, icon: Icon, color, onClick, state = 'idle', successLabel, description, variant = 'primary' }) => (
  <button
    onClick={onClick}
    disabled={state === 'loading'}
    className={`w-full p-4 rounded-xl border transition-all duration-200 backdrop-blur-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden ${variant === 'danger'
      ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30'
      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
      }`}
  >
    <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: color }} />
    <div className="relative z-10 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${variant === 'danger' ? 'bg-red-500/10' : ''}`} style={{ backgroundColor: variant === 'danger' ? undefined : `${color}15` }}>
        {state === 'loading' ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
        ) : state === 'success' ? (
          <CheckCircle2 className="w-5 h-5" style={{ color }} />
        ) : (
          <Icon className="w-5 h-5" style={{ color }} />
        )}
      </div>
      <div className="flex-1 text-left">
        <p className={`text-sm font-semibold ${variant === 'danger' ? 'text-red-400' : ''}`} style={{ color: variant === 'danger' ? undefined : color }}>
          {state === 'success' ? (successLabel ?? label) : label}
        </p>
        {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
      </div>
    </div>
  </button>
);

const DataSection: React.FC = () => {
  const queryClient = useQueryClient();
  const { navigateToImport, navigateToExport } = useNavigationStore();
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [cleanupState, setCleanupState] = useState<ActionState>('idle');
  const [resetState, setResetState] = useState<ActionState>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: profiles = [] } = useProfiles();
  const { data: activeProfile } = useActiveProfile();
  const [selectedSourceProfileId, setSelectedSourceProfileId] = useState<string>('');
  const [skipDuplicatesMerge, setSkipDuplicatesMerge] = useState<boolean>(true);
  const [mergeState, setMergeState] = useState<ActionState>('idle');
  const [confirmMerge, setConfirmMerge] = useState<boolean>(false);

  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);

  useEffect(() => {
    if (otherProfiles.length > 0 && !selectedSourceProfileId) {
      setSelectedSourceProfileId(otherProfiles[0].id);
    }
  }, [otherProfiles, selectedSourceProfileId]);

  const handleMergeProfiles = async () => {
    if (!selectedSourceProfileId) return;
    if (!confirmMerge) {
      setConfirmMerge(true);
      setTimeout(() => setConfirmMerge(false), 5000);
      return;
    }
    
    setMergeState('loading');
    setConfirmMerge(false);
    try {
      const result = await tauriApi.data.mergeProfileData(selectedSourceProfileId, skipDuplicatesMerge);
      setMergeState('success');
      showFeedback(
        t('settings.data.mergeSuccess', {
          collections: result.imported_collections,
          media: result.imported_media,
          images: result.imported_images,
        })
      );
      queryClient.invalidateQueries();
      refreshStorage();
      resetActionStates(setMergeState);
    } catch (e) {
      setMergeState('error');
      showFeedback(t('settings.data.mergeError', { error: String(e) }));
      resetActionStates(setMergeState);
    }
  };

  const refreshStorage = useCallback(async () => {
    try {
      const info = await tauriApi.data.getStorageInfo();
      setStorage(info);
    } catch (e) {
      console.error('Failed to get storage info:', e);
    }
  }, []);

  useEffect(() => { refreshStorage(); }, [refreshStorage]);

  const { t } = useTranslation();

  const showFeedback = (msg: string, duration = 4000) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), duration);
  };

  const resetActionStates = (setter: React.Dispatch<React.SetStateAction<ActionState>>) => {
    setTimeout(() => setter('idle'), 2500);
  };


  const handleCleanup = async () => {
    setCleanupState('loading');
    try {
      const report = await tauriApi.data.cleanupOrphanedImages();
      setCleanupState('success');
      const nothingDone = report.removed_dirs === 0 && report.removed_duplicates === 0;
      if (nothingDone) {
        showFeedback(t('settings.data.noOrphanImages'));
      } else {
        const parts: string[] = [];
        if (report.removed_dirs > 0) {
          parts.push(t('settings.data.cleanupSuccess', { dirs: report.removed_dirs, size: formatBytes(report.freed_bytes) }));
        }
        if (report.removed_duplicates > 0 && report.duplicate_details?.length > 0) {
          const details = report.duplicate_details
            .map((d: { media_title: string; removed_count: number }) =>
              `"${d.media_title}" (${d.removed_count} photo${d.removed_count > 1 ? 's' : ''} supprimée${d.removed_count > 1 ? 's' : ''})`
            )
            .join(', ');
          parts.push(`${report.removed_duplicates} photo${report.removed_duplicates > 1 ? 's' : ''} orpheline${report.removed_duplicates > 1 ? 's' : ''} supprimée${report.removed_duplicates > 1 ? 's' : ''} : ${details}`);
        }
        showFeedback(parts.join(' — '));
      }
      refreshStorage();
      resetActionStates(setCleanupState);
    } catch (e) {
      setCleanupState('error');
      showFeedback(t('settings.data.cleanupError', { error: e }));
      resetActionStates(setCleanupState);
    }
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 5000);
      return;
    }
    setResetState('loading');
    setConfirmReset(false);
    try {
      await tauriApi.data.resetDatabase();
      setResetState('success');
      showFeedback(t('settings.data.resetSuccess'));
      queryClient.invalidateQueries();
      refreshStorage();
      resetActionStates(setResetState);
    } catch (e) {
      setResetState('error');
      showFeedback(t('settings.data.resetError', { error: e }));
      resetActionStates(setResetState);
    }
  };


  const dbSize = storage?.db_size_bytes ?? 0;
  const imgSize = storage?.images_size_bytes ?? 0;
  const totalSize = storage?.total_size_bytes ?? 0;
  const storagePercent = totalSize > 0 ? Math.max(2, Math.min(100, Math.round((totalSize / (1024 * 1024 * 1024)) * 100))) : 0;

  return (
    <>
      {/* Feedback toast */}
      {feedbackMsg && (
        <div className="mb-4 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 animate-in fade-in slide-in-from-top-2">
          {feedbackMsg}
        </div>
      )}

      {/* Main grid layout: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3) - Sauvegarde + Stockage */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sauvegarde Card */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                {t('settings.data.backup')}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
              <GlassActionButton
                label={t('settings.data.export')}
                icon={Download}
                color="#10b981"
                description={t('settings.data.exportDescription')}
                onClick={navigateToExport}
              />
              <GlassActionButton
                label={t('settings.data.import')}
                icon={Upload}
                color="#3b82f6"
                description={t('settings.data.importDescription')}
                onClick={navigateToImport}
              />
            </div>
          </div>

          {/* Stockage Card */}
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                {t('settings.data.storage')}
              </h2>
              <button
                onClick={refreshStorage}
                className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                title={t('settings.data.refresh')}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">{t('settings.data.totalSpaceUsed')}</span>
                <span className="text-lg font-bold text-white">{formatBytes(totalSize)}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-flashy-blue transition-all duration-500 shadow-lg shadow-primary/25"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{t('settings.data.database')}</p>
                  <p className="text-lg font-semibold text-white">{formatBytes(dbSize)}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{t('settings.data.images')}</p>
                  <p className="text-lg font-semibold text-white">{formatBytes(imgSize)}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs text-white/30 px-1">
                <span>{storage?.total_media ?? 0} {t('common.media')}</span>
                <span>{storage?.total_images ?? 0} {t('common.image')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column (1/3) - Maintenance + Demo */}
        <div className="lg:col-span-1 space-y-6">
          {/* Maintenance Card */}
          <div className="glass-card-opaque rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-red-400" />
                {t('settings.data.maintenance')}
              </h2>
            </div>
            <div className="space-y-3 relative z-10">
              <GlassActionButton
                label={t('settings.data.cleanup')}
                icon={Trash2}
                color="#f97316"
                description={t('settings.data.cleanupDescription')}
                onClick={handleCleanup}
                state={cleanupState}
                successLabel={t('settings.data.cleaned')}
              />
              <GlassActionButton
                label={confirmReset ? t('settings.data.confirmReset') : t('settings.data.reset')}
                icon={Database}
                color="#ef4444"
                description={t('settings.data.resetDescription')}
                onClick={handleReset}
                state={resetState}
                successLabel={t('settings.data.resetSuccessLabel')}
                variant="danger"
              />
            </div>
          </div>

          {/* Card Fusion de Profils */}
          <div className="glass-card-opaque rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-primary" />
                {t('settings.data.mergeProfilesTitle')}
              </h2>
            </div>
            <div className="space-y-4 relative z-10">
              <p className="text-xs text-white/50">
                {t('settings.data.mergeProfilesDescription')}
              </p>

              {otherProfiles.length === 0 ? (
                <p className="text-xs text-white/30 italic py-2">
                  Aucun autre profil disponible pour la fusion.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">
                      {t('settings.data.selectSourceProfile')}
                    </label>
                    <select
                      value={selectedSourceProfileId}
                      onChange={(e) => setSelectedSourceProfileId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer"
                    >
                      {otherProfiles.map((p) => (
                        <option key={p.id} value={p.id} className="bg-neutral-900 text-white">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSkipDuplicatesMerge(!skipDuplicatesMerge)}
                      className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                        skipDuplicatesMerge ? 'bg-primary' : 'bg-white/10'
                      }`}
                      style={{ height: 18, width: 32 }}
                    >
                      <div
                        className="absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white shadow-md transition-transform"
                        style={{ left: skipDuplicatesMerge ? 15 : 2 }}
                      />
                    </button>
                    <span className="text-xs text-white/60">
                      {t('settings.data.skipDuplicatesLabel')}
                    </span>
                  </div>

                  <button
                    onClick={handleMergeProfiles}
                    disabled={mergeState === 'loading'}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                      confirmMerge
                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white'
                    }`}
                  >
                    {mergeState === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>{t('settings.data.mergeInProgress')}</span>
                      </>
                    ) : confirmMerge ? (
                      <span>{t('common.confirm')}</span>
                    ) : (
                      <>
                        <GitMerge className="w-4 h-4" />
                        <span>{t('settings.data.mergeBtn')}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default DataSection;