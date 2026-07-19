import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import {
  ArrowLeft,
  Target,
  Loader2,
  Calendar,
  Hash,
  Save,
  Settings2,
} from 'lucide-react';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import CustomDatePicker from '@/components/CustomDatePicker';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useCollections } from '@/hooks/useCollections';
import { useObjectives, useCreateObjective, useUpdateObjective } from '@/hooks/useObjectives';
import type { Objective } from '@/types';

const ObjectiveCreate: React.FC = () => {
  const { t } = useTranslation();
  const goBack = useNavigationStore((s) => s.goBack);
  const editingObjectiveId = useNavigationStore((s) => s.editingObjectiveId);
  const isEditing = editingObjectiveId !== null;

  const { data: collections = [] } = useCollections();
  const { data: objectives = [] } = useObjectives();
  const createMutation = useCreateObjective();
  const updateMutation = useUpdateObjective();

  const existing: Objective | undefined = useMemo(() => {
    if (!editingObjectiveId) return undefined;
    return objectives.find((o) => o.id === editingObjectiveId);
  }, [editingObjectiveId, objectives]);

  // Form state
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [targetCount, setTargetCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [countAbandoned, setCountAbandoned] = useState(false);
  const [formLoaded, setFormLoaded] = useState(false);

  // Init form
  useEffect(() => {
    if (isEditing && existing && !formLoaded) {
      setCollectionId(existing.collection_id);
      setTargetCount(String(existing.target_count));
      setStartDate(existing.start_date);
      setEndDate(existing.end_date);
      setCountAbandoned(existing.count_abandoned ?? false);
      setFormLoaded(true);
    } else if (!isEditing && !formLoaded) {
      if (collections.length > 0) setCollectionId(collections[0].id);
      const today = new Date();
      setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
      setFormLoaded(true);
    }
  }, [isEditing, existing, collections, formLoaded]);

  const selectedCollection = collections.find((c) => c.id === collectionId);
  const verb = selectedCollection?.consumption_verb || 'Consommer';

  const canSave =
    collectionId !== null &&
    targetCount.trim() !== '' &&
    Number(targetCount) > 0 &&
    startDate !== '' &&
    endDate !== '' &&
    startDate < endDate;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (!canSave || isSaving || !collectionId) return;

    try {
      if (isEditing && editingObjectiveId) {
        await updateMutation.mutateAsync({
          objective_id: editingObjectiveId,
          target_count: Number(targetCount),
          start_date: startDate,
          end_date: endDate,
          count_abandoned: countAbandoned,
        });
      } else {
        await createMutation.mutateAsync({
          collection_id: collectionId,
          target_count: Number(targetCount),
          start_date: startDate,
          end_date: endDate,
          count_abandoned: countAbandoned,
        });
      }
      goBack();
    } catch (err) {
      console.error('Failed to save objective:', err);
    }
  };

  return (
    <AppShell>
      <SharedHeader activePage="dashboard" />
      <MainContent>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={goBack}
              className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isEditing ? "Modifier l'objectif" : 'Nouvel objectif'}
              </h1>
              <p className="text-sm text-white/40 mt-0.5">
                {isEditing ? 'Modifiez les paramètres de votre objectif' : 'Définissez un objectif pour suivre votre progression'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/80 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(217,70,239,0.25)]"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? t('common.save') : t('common.create')}
          </button>
        </div>

        {/* Responsive grid: 1 column on mobile, 2/3 + 1/3 on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* LEFT COLUMN (2/3) - Main form inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Collection Selector */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-flashy-purple" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('common.collection')}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {collections.map((c) => {
                  const Icon = getCollectionIconComponent(c.name, c.icon);
                  const isSelected = collectionId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCollectionId(c.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-white/20 bg-white/10'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                      }`}
                      style={isSelected ? { borderColor: `${c.color}50`, backgroundColor: `${c.color}12` } : undefined}
                    >
                      <Icon className="w-6 h-6 transition-colors" style={{ color: isSelected ? c.color : undefined }} />
                      <span className={`text-xs font-medium truncate w-full text-center ${isSelected ? 'text-white' : 'text-white/50'}`}>
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Objective Details */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="w-4 h-4 text-flashy-blue" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('stats.objectives')}</h2>
              </div>

              {/* Verb + count inline */}
              {selectedCollection && (
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-5 py-4">
                  <span className="text-white font-semibold text-lg">{verb}</span>
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={targetCount}
                      onChange={(e) => setTargetCount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="?"
                      className="w-16 bg-transparent text-white font-bold text-xl text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <span className="text-white font-semibold text-lg">{selectedCollection.name.toLowerCase()}</span>
                </div>
              )}

              {!selectedCollection && (
                <p className="text-sm text-white/30 py-4 text-center">{t('objectiveCreate.selectCollection')}</p>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN (1/3) - Period & Options */}
          <div className="lg:col-span-1 space-y-6">
            {/* Period */}
            <div className="glass-card rounded-2xl p-6 relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('objectiveCreate.period')}</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">
                    {t('objectiveCreate.startDate')}
                  </label>
                  <CustomDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder={t('objectiveCreate.start')}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">
                    {t('objectiveCreate.endDate')}
                  </label>
                  <CustomDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder={t('objectiveCreate.end')}
                  />
                </div>
              </div>

              {startDate && endDate && startDate < endDate && (
                <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {t('objectiveCreate.duration', { days: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) })}
                  </span>
                </div>
              )}

              {startDate && endDate && startDate >= endDate && (
                <p className="mt-3 text-xs text-red-400 font-medium">{t('objectiveCreate.endDateAfterStart')}</p>
              )}
            </div>

            {/* Options */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 text-white/50" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('objectiveCreate.options')}</h2>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{t('objectiveCreate.countAbandoned')}</p>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    {t('objectiveCreate.countAbandonedHint')}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                  <input
                    type="checkbox"
                    checked={countAbandoned}
                    onChange={(e) => setCountAbandoned(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-[18px] bg-white/10 peer-checked:bg-primary/60 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-[14px]" />
                </label>
              </div>
            </div>

            <div className="h-8" />
          </div>
        </div>

        {/* Preview - Full width below grid */}
        {canSave && selectedCollection && (
          <div className="mt-6 rounded-2xl p-6 border border-primary/20 relative bg-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t('collectionEdit.previewTitle')}</h2>
            </div>
            <p className="text-white/70 text-sm">
              <span className="text-white font-semibold">{verb}</span>{' '}
              <span className="text-white font-bold">{targetCount}</span>{' '}
              <span className="text-white font-semibold">{selectedCollection.name.toLowerCase()}</span>{' '}
              {t('objectiveCreate.previewFrom')}{' '}
              <span className="text-white/90 font-medium">{new Date(startDate).toLocaleDateString(i18next.language === 'fr' ? 'fr-FR' : 'en-US')}</span>{' '}
              {t('objectiveCreate.previewTo')}{' '}
              <span className="text-white/90 font-medium">{new Date(endDate).toLocaleDateString(i18next.language === 'fr' ? 'fr-FR' : 'en-US')}</span>{' '}
              {' — '}
              <span className="text-white/50">
                {t('objectiveCreate.days', { count: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) })}
              </span>
              {countAbandoned && (
                <span className="text-white/40"> · {t('objectiveCreate.abandonedIncluded')}</span>
              )}
            </p>
          </div>
        )}
      </MainContent>
    </AppShell>
  );
};

export default ObjectiveCreate;
