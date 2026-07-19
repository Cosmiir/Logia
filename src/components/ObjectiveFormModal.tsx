import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, Loader2, Calendar, Hash } from 'lucide-react';
import CustomDatePicker from '@/components/CustomDatePicker';
import { getCollectionIconComponent } from '@/components/CollectionIcons';
import type { Collection, Objective } from '@/types';

interface ObjectiveFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { collection_id: number; target_count: number; start_date: string; end_date: string }) => void;
  collections: Collection[];
  editingObjective?: Objective | null;
  isSaving?: boolean;
}

const ObjectiveFormModal: React.FC<ObjectiveFormModalProps> = ({
  open,
  onClose,
  onSubmit,
  collections,
  editingObjective,
  isSaving = false,
}) => {
  const { t } = useTranslation();
  const [collectionId, setCollectionId] = useState<number | null>(null);
  const [targetCount, setTargetCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (editingObjective) {
        setCollectionId(editingObjective.collection_id);
        setTargetCount(String(editingObjective.target_count));
        setStartDate(editingObjective.start_date);
        setEndDate(editingObjective.end_date);
      } else {
        setCollectionId(collections.length > 0 ? collections[0].id : null);
        setTargetCount('');
        const today = new Date();
        setStartDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
        setEndDate('');
      }
    }
  }, [open, editingObjective, collections]);

  const selectedCollection = collections.find((c) => c.id === collectionId);
  const verb = selectedCollection?.consumption_verb || 'Consommer';

  const canSave =
    collectionId !== null &&
    targetCount.trim() !== '' &&
    Number(targetCount) > 0 &&
    startDate !== '' &&
    endDate !== '' &&
    startDate < endDate;

  const handleSubmit = () => {
    if (!canSave || !collectionId) return;
    onSubmit({
      collection_id: collectionId,
      target_count: Number(targetCount),
      start_date: startDate,
      end_date: endDate,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg mx-4 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-flashy-purple/15 flex items-center justify-center">
                  <Target className="w-4.5 h-4.5 text-flashy-purple" />
                </div>
                <h2 className="text-base font-bold text-white">
                  {editingObjective ? t('objectiveCreate.editObjective') : t('objectiveCreate.newObjective')}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Collection selector */}
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">
                  Collection
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {collections.map((c) => {
                    const Icon = getCollectionIconComponent(c.name, c.icon);
                    const isSelected = collectionId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCollectionId(c.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-white/20 bg-white/10'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                        }`}
                        style={isSelected ? { borderColor: `${c.color}50`, backgroundColor: `${c.color}12` } : undefined}
                      >
                        <Icon className="w-5 h-5 transition-colors" style={{ color: isSelected ? c.color : undefined }} />
                        <span className={`text-[11px] font-medium truncate w-full text-center ${isSelected ? 'text-white' : 'text-white/50'}`}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Objective description line */}
              {selectedCollection && (
                <div className="flex items-center gap-2 text-sm text-white/60 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
                  <span className="text-white font-medium">{verb}</span>
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                    <Hash className="w-3 h-3 text-flashy-blue" />
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={targetCount}
                      onChange={(e) => setTargetCount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={t('objectiveCreate.targetPlaceholder')}
                      className="w-12 bg-transparent text-white font-bold text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <span className="text-white font-medium">{selectedCollection.name.toLowerCase()}</span>
                </div>
              )}

              {/* Date pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {t('objectiveCreate.startDateLabel')}
                  </label>
                  <CustomDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder={t('objectiveCreate.startDatePlaceholder')}
                    compact
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {t('objectiveCreate.endDateLabel')}
                  </label>
                  <CustomDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder={t('objectiveCreate.endDatePlaceholder')}
                    compact
                  />
                </div>
              </div>

              {/* Validation hints */}
              {startDate && endDate && startDate >= endDate && (
                <p className="text-xs text-red-400">{t('objectiveCreate.endDateAfterStart')}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSave || isSaving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/80 rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(217,70,239,0.25)]"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
                {editingObjective ? t('common.save') : t('objectiveCreate.createObjective')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ObjectiveFormModal;
