import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Trash2,
  Loader2,
  Sparkles,
  Type,
  Palette as PaletteIcon,
  UserPen,
  CalendarClock,
  Clock,
  Info,
  ListOrdered,
  Save,
  MessageSquare,
  Target,
} from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import ColorPicker from '@/components/ColorPicker';
import { useNavigationStore } from '@/stores/useNavigationStore';
import {
  useCollection,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollectionWithOptions,
  useCollections,
} from '@/hooks/useCollections';
import {
  COLLECTION_ICONS,
  COLLECTION_COLORS,
  getPresetLabels,
  getIconById,
} from '@/lib/collection-icons';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import type { LucideIcon } from 'lucide-react';

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

const SectionLabel: React.FC<{ icon: LucideIcon; label: string; hint?: string }> = ({
  icon: Icon,
  label,
  hint,
}) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="w-4 h-4 text-flashy-purple" />
    <span className="text-sm font-semibold text-white">{label}</span>
    {hint && (
      <span className="text-[10px] text-text-secondary ml-auto flex items-center gap-1">
        <Info className="w-3 h-3" />
        {hint}
      </span>
    )}
  </div>
);

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

const CollectionEdit: React.FC = () => {
  const { t } = useTranslation();
  const { editingCollectionId: editingId, goBack, setBeforeNavigate, forceNavigate } = useNavigationStore();
  const isEditing = editingId !== null;

  const { data: existing, isLoading: loadingExisting } = useCollection(editingId);
  const { data: collections } = useCollections();
  const createMutation = useCreateCollection();
  const updateMutation = useUpdateCollection();
  const deleteCollWithOptionsMutation = useDeleteCollectionWithOptions();

  // Form state
  const [name, setName] = useState('');
  const [iconId, setIconId] = useState<string>('clapperboard');
  const [color, setColor] = useState(COLLECTION_COLORS[0]);
  const [creatorLabel, setCreatorLabel] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [progressionLabel, setProgressionLabel] = useState('');
  const [progressionShortLabel, setProgressionShortLabel] = useState('');
  const [replayDateLabel, setReplayDateLabel] = useState('');
  const [durationLabel, setDurationLabel] = useState('');
  const [pluralWithS, setPluralWithS] = useState(false);
  const [consumptionVerb, setConsumptionVerb] = useState('');
  const [monthlyCapacity, setMonthlyCapacity] = useState('');
  const [collectionToDelete, setCollectionToDelete] = useState(false);
  const [collDeleteMode, setCollDeleteMode] = useState<'delete_media' | 'unlink' | 'transfer'>('delete_media');
  const [collTransferTarget, setCollTransferTarget] = useState<number | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editFormLoaded, setEditFormLoaded] = useState(false);

  // Dirty tracking
  const formDirtyRef = useRef(false);
  const initialSnapshotRef = useRef<string | null>(null);

  const serializeForm = useCallback(() => JSON.stringify({ name, iconId, color, creatorLabel, dateLabel, progressionLabel, progressionShortLabel, replayDateLabel, durationLabel, pluralWithS, consumptionVerb, monthlyCapacity }), [name, iconId, color, creatorLabel, dateLabel, progressionLabel, progressionShortLabel, replayDateLabel, durationLabel, pluralWithS, consumptionVerb, monthlyCapacity]);

  // Fill form when editing an existing collection
  useEffect(() => {
    if (existing && !editFormLoaded) {
      setName(existing.name);
      setIconId(existing.icon ?? 'clapperboard');
      setColor(existing.color);
      setCreatorLabel(existing.creator_label);
      setDateLabel(existing.date_label);
      setProgressionLabel(existing.progression_label || '');
      setProgressionShortLabel(existing.progression_short_label || '');
      setReplayDateLabel(existing.replay_date_label || '');
      setDurationLabel(existing.duration_label || '');
      setPluralWithS(existing.plural_with_s ?? false);
      setConsumptionVerb(existing.consumption_verb || '');
      setMonthlyCapacity(existing.monthly_capacity ? String(existing.monthly_capacity) : '');
      setEditFormLoaded(true);
    }
  }, [existing, editFormLoaded]);

  // Take initial snapshot after form loads
  useEffect(() => {
    if (isEditing && !editFormLoaded) return;
    if (initialSnapshotRef.current === null) {
      // Delay one tick so state is settled
      requestAnimationFrame(() => {
        initialSnapshotRef.current = serializeForm();
      });
    }
  }, [editFormLoaded, isEditing, serializeForm]);

  // Detect changes
  useEffect(() => {
    if (initialSnapshotRef.current === null) return;
    formDirtyRef.current = serializeForm() !== initialSnapshotRef.current;
  }, [serializeForm]);

  // Navigation guard
  useEffect(() => {
    setBeforeNavigate(() => {
      if (!formDirtyRef.current) return true;
      setShowLeaveDialog(true);
      return false;
    });
    return () => setBeforeNavigate(null);
  }, [setBeforeNavigate]);

  // Get suggested placeholders based on collection name
  const presetLabels = useMemo(() => getPresetLabels(name.trim()), [name]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  
  const canSave = name.trim().length > 0 && name.trim().length <= 50;

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setSaveError(null);

    try {
      if (isEditing && editingId) {
        const finalProgressionLabel = progressionLabel.trim() || presetLabels?.progression_label || t('collectionEdit.defaults.episode');
        await updateMutation.mutateAsync({
          collection_id: editingId,
          name: name.trim(),
          icon: iconId,
          color,
          creator_label: creatorLabel.trim() || presetLabels?.creator_label || t('collectionEdit.defaults.creator'),
          date_label: dateLabel.trim() || presetLabels?.date_label || t('collectionEdit.defaults.experienceDate'),
          progression_label: finalProgressionLabel,
          progression_short_label: progressionShortLabel.trim() || finalProgressionLabel,
          replay_date_label: replayDateLabel.trim() || undefined,
          duration_label: durationLabel.trim() || presetLabels?.duration_label || undefined,
          plural_with_s: pluralWithS,
          consumption_verb: consumptionVerb.trim() || undefined,
          monthly_capacity: monthlyCapacity.trim() ? Number(monthlyCapacity) : undefined,
        });
      } else {
        const finalProgressionLabel = progressionLabel.trim() || presetLabels?.progression_label || t('collectionEdit.defaults.episode');
        await createMutation.mutateAsync({
          name: name.trim(),
          icon: iconId,
          color,
          creator_label: creatorLabel.trim() || presetLabels?.creator_label || t('collectionEdit.defaults.creator'),
          date_label: dateLabel.trim() || presetLabels?.date_label || t('collectionEdit.defaults.experienceDate'),
          progression_label: finalProgressionLabel,
          progression_short_label: progressionShortLabel.trim() || finalProgressionLabel,
          replay_date_label: replayDateLabel.trim() || undefined,
          duration_label: durationLabel.trim() || presetLabels?.duration_label || undefined,
          plural_with_s: pluralWithS,
          consumption_verb: consumptionVerb.trim() || undefined,
          monthly_capacity: monthlyCapacity.trim() ? Number(monthlyCapacity) : undefined,
        });
      }

      formDirtyRef.current = false;
      forceNavigate('library');
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message ?? '';
      if (msg.includes('UNIQUE constraint failed')) {
        setSaveError(t('collectionEdit.errors.nameExists'));
      } else {
        setSaveError(msg || t('collectionEdit.errors.genericError'));
      }
    }
  };

  const handleDelete = () => {
    setCollectionToDelete(true);
    setCollDeleteMode('delete_media');
    setCollTransferTarget(null);
  };

  const confirmDeleteCollection = async () => {
    if (!editingId || !collectionToDelete) return;
    
    try {
      await deleteCollWithOptionsMutation.mutateAsync({
        collectionId: editingId,
        mode: collDeleteMode,
        targetCollectionId: collTransferTarget ?? undefined,
      });
      formDirtyRef.current = false;
      forceNavigate('library');
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  // Preview icon
  const PreviewIcon = useMemo(() => getIconById(iconId), [iconId]);

  if (isEditing && loadingExisting) {
    return (
      <AppShell>
        <SharedHeader activePage="library" />
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SharedHeader activePage="library" />

      <MainContent>
        {/* Top bar: back + title + actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-white">
              {isEditing ? t('collectionEdit.editCollection') : t('collectionEdit.newCollection')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={deleteCollWithOptionsMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer bg-white/5 border border-white/10 text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
              >
                {deleteCollWithOptionsMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {t('media.delete')}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/80 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(217,70,239,0.25)]"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditing ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT COLUMN (2/3) - Main form inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Name */}
            <div className="glass-card rounded-2xl p-6">
              <SectionLabel icon={Type} label={t('collectionEdit.collectionName')} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('collectionEdit.namePlaceholder')}
                maxLength={50}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
              {name.trim().length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  {presetLabels && !isEditing && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-1 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      {t('collectionEdit.suggestedLabels')}
                    </span>
                  )}
                  <span className="text-[10px] text-text-secondary ml-auto">
                    {name.trim().length}/50
                  </span>
                </div>
              )}
              {saveError && (
                <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
                  {saveError}
                </div>
              )}
            </div>

            {/* Dynamic Labels */}
            <div className="glass-card rounded-2xl p-6 space-y-6">
            <div>
              <SectionLabel
                icon={UserPen}
                label={t('collectionEdit.creatorFieldName')}
                hint={t('collectionEdit.hints.adaptedToType')}
              />
              <input
                type="text"
                value={creatorLabel}
                onChange={(e) => setCreatorLabel(e.target.value)}
                placeholder={presetLabels?.creator_label || t('collectionEdit.placeholders.creatorExamples')}
                maxLength={50}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
              <p className="mt-2 text-[11px] text-text-secondary">
                {t('collectionEdit.descriptions.fieldDisplay')} <span className="text-white/70 font-medium">« {creatorLabel || presetLabels?.creator_label || t('collectionEdit.defaults.creator')} »</span>
              </p>
            </div>

            <div className="border-t border-white/5 pt-6">
              <SectionLabel
                icon={CalendarClock}
                label={t('collectionEdit.dateFields')}
                hint={t('collectionEdit.hints.adaptedToType')}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5 block">{t('collectionEdit.experienceDate')}</label>
                  <input
                    type="text"
                    value={dateLabel}
                    onChange={(e) => setDateLabel(e.target.value)}
                    placeholder={presetLabels?.date_label || t('collectionEdit.placeholders.experienceDate')}
                    maxLength={80}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5 block">{t('collectionEdit.newExperience')}</label>
                  <input
                    type="text"
                    value={replayDateLabel}
                    onChange={(e) => setReplayDateLabel(e.target.value)}
                    placeholder={t('collectionEdit.replayDatePlaceholder')}
                    maxLength={80}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-text-secondary">
                {t('collectionEdit.descriptions.displayedFields')} <span className="text-white/70 font-medium">« {dateLabel || presetLabels?.date_label || t('collectionEdit.defaults.experienceDate')} »</span> et <span className="text-white/70 font-medium">« {replayDateLabel || t('collectionEdit.defaults.newExperience')} »</span>
              </p>
            </div>

            <div className="border-t border-white/5 pt-6">
              <SectionLabel
                icon={ListOrdered}
                label={t('collectionEdit.progressionFieldName')}
                hint={t('collectionEdit.hints.unitInTracking')}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5 block">{t('collectionEdit.fullName')}</label>
                  <input
                    type="text"
                    value={progressionLabel}
                    onChange={(e) => setProgressionLabel(e.target.value)}
                    placeholder={presetLabels?.progression_label || 'Ex: Episode, Chapter...'}
                    maxLength={50}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5 block">{t('collectionEdit.shortLabel')}</label>
                  <input
                    type="text"
                    value={progressionShortLabel}
                    onChange={(e) => setProgressionShortLabel(e.target.value)}
                    placeholder={progressionLabel.trim() || presetLabels?.progression_label || t('collectionEdit.placeholders.shortLabel')}
                    maxLength={20}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-text-secondary">
                {t('collectionEdit.descriptions.trackingDisplay').replace('...', `<span className="text-white/70 font-medium">« ${progressionLabel || presetLabels?.progression_label || t('collectionEdit.defaults.episode')} actuel »</span>`)} <span className="text-white/70 font-medium">« {progressionShortLabel.trim() || progressionLabel.trim() || presetLabels?.progression_label || t('collectionEdit.defaults.episode')} »</span>
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{t('collectionEdit.autoPlural')}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">{t('collectionEdit.autoPluralHint')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                  <input
                    type="checkbox"
                    checked={pluralWithS}
                    onChange={(e) => setPluralWithS(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-[18px] bg-white/10 peer-checked:bg-primary/60 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-[14px]" />
                </label>
              </div>
            </div>

            <div className="border-t border-white/5 pt-6">
              <SectionLabel
                icon={Clock}
                label={t('collectionEdit.totalDurationField')}
                hint={t('collectionEdit.hints.totalUnitsDisplay')}
              />
              <input
                type="text"
                value={durationLabel}
                onChange={(e) => setDurationLabel(e.target.value)}
                placeholder={presetLabels?.duration_label || t('collectionEdit.placeholders.durationExamples')}
                maxLength={50}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
              <p className="mt-2 text-[11px] text-text-secondary">
                {t('collectionEdit.descriptions.mediaPageDisplay')} <span className="text-white/70 font-medium">« {durationLabel || presetLabels?.duration_label || t('collectionEdit.defaults.total')} »</span>
              </p>
            </div>

            <div className="border-t border-white/5 pt-6">
              <SectionLabel
                icon={MessageSquare}
                label={t('collectionEdit.consumptionVerb')}
                hint={t('collectionEdit.hints.consumptionVerb')}
              />
              <input
                type="text"
                value={consumptionVerb}
                onChange={(e) => setConsumptionVerb(e.target.value)}
                placeholder={t('collectionEdit.verbPlaceholder')}
                maxLength={30}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm"
              />
              <p className="mt-2 text-[11px] text-text-secondary">
                Affiché dans les objectifs : <span className="text-white/70 font-medium">« {consumptionVerb.trim() || 'Consommer'} 20 {name.trim().toLowerCase() || 'médias'} »</span>
              </p>
            </div>

            <div className="border-t border-white/5 pt-6">
              <SectionLabel
                icon={Target}
                label={t('collectionEdit.monthlyCapacity')}
                hint={t('collectionEdit.capacityDescription')}
              />
              <input
                type="number"
                min={1}
                max={999}
                value={monthlyCapacity}
                onChange={(e) => setMonthlyCapacity(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={t('collectionEdit.capacityPlaceholder')}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-text-secondary focus:outline-none focus:border-primary/50 transition-colors text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="mt-2 text-[11px] text-text-secondary">
                {monthlyCapacity.trim()
                  ? <>{t('collectionEdit.capacityHint', { verb: consumptionVerb.trim().toLowerCase() || 'consommer', count: monthlyCapacity, name: name.trim().toLowerCase() || 'médias' })}</>
                  : <>{t('collectionEdit.capacityEmptyHint')}</>}
              </p>
            </div>
          </div>
          </div>

          {/* RIGHT COLUMN (1/3) - Visual elements */}
          <div className="lg:col-span-1 space-y-6">
            {/* Live Preview Card */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-flashy-purple" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('collectionEdit.previewTitle')}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor: `${color}20`,
                    border: `2px solid ${color}50`,
                    boxShadow: `0 0 20px ${color}20`,
                  }}
                >
                  <PreviewIcon className="w-6 h-6 transition-colors duration-300" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">
                    {name.trim() || t('collectionEdit.preview.defaultName')}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-text-secondary">
                    <span className="truncate">{creatorLabel || presetLabels?.creator_label || t('collectionEdit.defaults.creator')} : ...</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-secondary">
                    <span className="truncate">{progressionLabel || presetLabels?.progression_label || t('collectionEdit.defaults.episode')} : 0/??</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Color Picker */}
            <div className="glass-card rounded-2xl p-6">
              <SectionLabel icon={PaletteIcon} label={t('collectionEdit.color')} hint={t('collectionEdit.colorHint')} />
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {/* Icon Picker */}
            <div className="glass-card rounded-2xl p-6">
              <SectionLabel icon={Sparkles} label={t('collectionEdit.icon')} hint={t('collectionEdit.iconHint')} />
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {COLLECTION_ICONS.map((entry) => {
                  const EntryIcon = entry.icon;
                  const isSelected = iconId === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setIconId(entry.id)}
                      title={entry.label}
                      className={`group relative flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-white/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                      }`}
                      style={isSelected ? {
                        borderColor: `${color}80`,
                        boxShadow: `0 0 10px ${color}30`,
                      } : undefined}
                    >
                      <EntryIcon
                        className={`w-4 h-4 transition-colors ${
                          isSelected ? 'text-white' : 'text-gray-400 group-hover:text-white'
                        }`}
                      />
                      {isSelected && (
                        <div
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: color }}
                        >
                          <Check className="w-1.5 h-1.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-8" />
          </div>
        </div>
      </MainContent>

      {/* Leave confirmation dialog */}
      <ConfirmDialog
        open={showLeaveDialog}
        onClose={() => setShowLeaveDialog(false)}
        title={t('collectionEdit.unsavedChanges')}
        description={t('collectionEdit.unsavedChangesDescription')}
        iconColor="#f59e0b"
        actions={[{
          label: t('collectionEdit.leaveWithoutSaving'),
          variant: 'danger',
          onClick: () => {
            setShowLeaveDialog(false);
            formDirtyRef.current = false;
            goBack();
          },
        }]}
      />

      {/* Confirm: delete collection with options */}
      <ConfirmDialog
        open={collectionToDelete}
        onClose={() => setCollectionToDelete(false)}
        title={t('media.confirmDeleteCollectionTitle', { name: existing?.name })}
        description={t('media.chooseWhatToDoWithMedia')}
        iconColor="#ef4444"
        actions={[{
          label: collDeleteMode === 'transfer' ? t('media.transferAndDelete') : collDeleteMode === 'unlink' ? t('media.unlinkAndDelete') : t('media.deleteAll'),
          variant: 'danger',
          icon: Trash2,
          onClick: confirmDeleteCollection,
        }]}
      >
        <div className="space-y-2">
          {/* Option 1: Delete media */}
          <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5"
            style={{ borderColor: collDeleteMode === 'delete_media' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)', backgroundColor: collDeleteMode === 'delete_media' ? 'rgba(239,68,68,0.05)' : 'transparent' }}
            onClick={() => setCollDeleteMode('delete_media')}
          >
            <input type="radio" name="collDeleteMode" checked={collDeleteMode === 'delete_media'} onChange={() => setCollDeleteMode('delete_media')} className="accent-red-500" />
            <div>
              <p className="text-sm font-semibold text-white">{t('media.deleteMedia')}</p>
              <p className="text-[11px] text-white/40">{t('media.deleteMediaHint')}</p>
            </div>
          </label>
          {/* Option 2: Unlink — keep media with no collection */}
          <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5"
            style={{ borderColor: collDeleteMode === 'unlink' ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)', backgroundColor: collDeleteMode === 'unlink' ? 'rgba(168,85,247,0.05)' : 'transparent' }}
            onClick={() => setCollDeleteMode('unlink')}
          >
            <input type="radio" name="collDeleteMode" checked={collDeleteMode === 'unlink'} onChange={() => setCollDeleteMode('unlink')} className="accent-purple-500" />
            <div>
              <p className="text-sm font-semibold text-white">{t('media.keepMediaWithoutCollection')}</p>
              <p className="text-[11px] text-white/40">{t('media.keepMediaHint')}</p>
            </div>
          </label>
          {/* Option 3: Transfer */}
          <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-white/5"
            style={{ borderColor: collDeleteMode === 'transfer' ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)', backgroundColor: collDeleteMode === 'transfer' ? 'rgba(59,130,246,0.05)' : 'transparent' }}
            onClick={() => setCollDeleteMode('transfer')}
          >
            <input type="radio" name="collDeleteMode" checked={collDeleteMode === 'transfer'} onChange={() => setCollDeleteMode('transfer')} className="accent-blue-500" />
            <div>
              <p className="text-sm font-semibold text-white">{t('media.transferToAnotherCollection')}</p>
              <p className="text-[11px] text-white/40">{t('media.transferHint')}</p>
            </div>
          </label>
          {collDeleteMode === 'transfer' && (
            <div className="mt-3 pl-6">
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1.5 block">{t('media.targetCollection')}</span>
              {(() => {
                const transferOptions = collections?.filter(c => c.id !== existing?.id) ?? [];
                if (transferOptions.length === 0) {
                  return <p className="text-[11px] text-white/30 text-center py-2 mt-1">{t('media.noOtherCollection')}</p>;
                }
                return (
                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar rounded-xl border border-white/10 bg-white/[0.02] p-1.5 space-y-1">
                    {transferOptions.map(c => {
                      const Icon = getCollectionIconComponent(c.name, c.icon);
                      const isChosen = collTransferTarget === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCollTransferTarget(c.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isChosen ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color}15` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                          </div>
                          <span className={`text-sm font-medium truncate flex-1 ${isChosen ? 'text-white' : 'text-white/60'}`}>{c.name}</span>
                          {isChosen && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </ConfirmDialog>
    </AppShell>
  );
};

export default CollectionEdit;
