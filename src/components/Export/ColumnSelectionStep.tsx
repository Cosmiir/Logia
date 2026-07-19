import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Check, ChevronRight, ChevronLeft, GripVertical, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ColumnDef {
  key: string;
  labelKey: string;
  descKey: string;
  category: 'identite' | 'progression' | 'evaluation' | 'meta';
}

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'title',         labelKey: 'export.columnDefs.title.label',              descKey: 'export.columnDefs.title.desc',                        category: 'identite' },
  { key: 'collection',    labelKey: 'export.columnDefs.collection.label',          descKey: 'export.columnDefs.collection.desc',           category: 'identite' },
  { key: 'creator',       labelKey: 'export.columnDefs.creator.label',            descKey: 'export.columnDefs.creator.desc',        category: 'identite' },
  { key: 'release_date',  labelKey: 'export.columnDefs.release_date.label',      descKey: 'export.columnDefs.release_date.desc',           category: 'identite' },
  { key: 'genre_ids',     labelKey: 'export.columnDefs.genre_ids.label',          descKey: 'export.columnDefs.genre_ids.desc', category: 'identite' },
  { key: 'synopsis',      labelKey: 'export.columnDefs.synopsis.label',           descKey: 'export.columnDefs.synopsis.desc',                category: 'identite' },
  { key: 'media_status',  labelKey: 'export.columnDefs.media_status.label',      descKey: 'export.columnDefs.media_status.desc',         category: 'identite' },
  { key: 'progress_status',  labelKey: 'export.columnDefs.progress_status.label', descKey: 'export.columnDefs.progress_status.desc', category: 'progression' },
  { key: 'progress_current', labelKey: 'export.columnDefs.progress_current.label', descKey: 'export.columnDefs.progress_current.desc',    category: 'progression' },
  { key: 'progress_total',   labelKey: 'export.columnDefs.progress_total.label',   descKey: 'export.columnDefs.progress_total.desc',       category: 'progression' },
  { key: 'replay_count',     labelKey: 'export.columnDefs.replay_count.label',     descKey: 'export.columnDefs.replay_count.desc',      category: 'progression' },
  { key: 'experience_date',  labelKey: 'export.columnDefs.experience_date.label',  descKey: 'export.columnDefs.experience_date.desc', category: 'progression' },
  { key: 'experience_entries', labelKey: 'export.columnDefs.experience_entries.label', descKey: 'export.columnDefs.experience_entries.desc', category: 'progression' },
  { key: 'user_rating',      labelKey: 'export.columnDefs.user_rating.label',     descKey: 'export.columnDefs.user_rating.desc',              category: 'evaluation' },
  { key: 'user_review',      labelKey: 'export.columnDefs.user_review.label',     descKey: 'export.columnDefs.user_review.desc',            category: 'evaluation' },
  { key: 'positive_points',  labelKey: 'export.columnDefs.positive_points.label',  descKey: 'export.columnDefs.positive_points.desc',               category: 'evaluation' },
  { key: 'negative_points',  labelKey: 'export.columnDefs.negative_points.label',  descKey: 'export.columnDefs.negative_points.desc',        category: 'evaluation' },
  { key: 'id',          labelKey: 'export.columnDefs.id.label',          descKey: 'export.columnDefs.id.desc',     category: 'meta' },
  { key: 'created_at',  labelKey: 'export.columnDefs.created_at.label',  descKey: 'export.columnDefs.created_at.desc',  category: 'meta' },
  { key: 'updated_at',  labelKey: 'export.columnDefs.updated_at.label',  descKey: 'export.columnDefs.updated_at.desc',          category: 'meta' },
];

const CATEGORIES = [
  { id: 'identite',    labelKey: 'export.columnCats.identite',    color: 'text-indigo-400',  bg: 'bg-indigo-400/10 border-indigo-400/20' },
  { id: 'progression', labelKey: 'export.columnCats.progression', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  { id: 'evaluation',  labelKey: 'export.columnCats.evaluation',  color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20' },
  { id: 'meta',        labelKey: 'export.columnCats.meta',        color: 'text-white/40',    bg: 'bg-white/5 border-white/10' },
];

const DEFAULT_SELECTED = ['title', 'collection', 'creator', 'release_date', 'genre_ids', 'user_rating', 'progress_status', 'media_status'];

interface ColumnSelectionStepProps {
  selectedColumns: string[];
  setSelectedColumns: (cols: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const ColumnSelectionStep: React.FC<ColumnSelectionStepProps> = ({
  selectedColumns,
  setSelectedColumns,
  onNext,
  onBack,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { t } = useTranslation();

  const filteredColumns = useMemo(() => {
    return ALL_COLUMNS.filter(col => {
      const matchesSearch = !search || 
        t(col.labelKey).toLowerCase().includes(search.toLowerCase()) ||
        t(col.descKey).toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !activeCategory || col.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory, t]);

  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      setSelectedColumns(selectedColumns.filter(k => k !== key));
    } else {
      setSelectedColumns([...selectedColumns, key]);
    }
  };

  const selectAll = () => setSelectedColumns(ALL_COLUMNS.map(c => c.key));
  const selectNone = () => setSelectedColumns([]);
  const selectDefault = () => setSelectedColumns(DEFAULT_SELECTED);

  const getCategoryMeta = (catId: string) => CATEGORIES.find(c => c.id === catId)!;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{t('export.columnSelection')}</h2>
          <p className="text-white/50 text-sm">{t('export.columnSelectionHint')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-white/40">{t('export.columnsCount', { selected: selectedColumns.length, total: ALL_COLUMNS.length })}</span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all cursor-pointer"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {t('common.preview')}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-white/30">{t('export.quickSelection')}</span>
        <button onClick={selectDefault} className="px-3 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs transition-all cursor-pointer border border-primary/20">{t('common.recommended')}</button>
        <button onClick={selectAll} className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all cursor-pointer border border-white/10">{t('common.all')}</button>
        <button onClick={selectNone} className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all cursor-pointer border border-white/10">{t('common.none')}</button>
      </div>

      {/* Search + category filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('import.searchColumn')}
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border', 
              !activeCategory ? 'bg-white/10 border-white/20 text-white' : 'bg-white/3 border-white/5 text-white/40 hover:text-white/70')}
          >
            {t('common.all')}
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border',
                activeCategory === cat.id ? `${cat.bg} ${cat.color}` : 'bg-white/3 border-white/5 text-white/40 hover:text-white/70')}
            >
              {t(cat.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
        <AnimatePresence>
          {filteredColumns.map(col => {
            const isSelected = selectedColumns.includes(col.key);
            const catMeta = getCategoryMeta(col.category);
            return (
              <motion.button
                key={col.key}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.1 }}
                onClick={() => toggleColumn(col.key)}
                className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer group',
                  isSelected
                    ? 'glass-card border-primary/40 bg-primary/5'
                    : 'glass-card border-white/5 hover:border-white/15'
                )}
              >
                {/* Checkbox */}
                <div className={cn(
                  'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
                  isSelected ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-white/40'
                )}>
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-medium', isSelected ? 'text-white' : 'text-white/70')}>
                      {t(col.labelKey)}
                    </span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-md border shrink-0', catMeta.bg, catMeta.color)}>
                      {t(catMeta.labelKey)}
                    </span>
                  </div>
                  <p className="text-xs text-white/30 mt-0.5 truncate">{t(col.descKey)}</p>
                </div>

                <GripVertical className="w-3.5 h-3.5 text-white/10 shrink-0" />
              </motion.button>
            );
          })}
        </AnimatePresence>
        {filteredColumns.length === 0 && (
          <div className="col-span-2 py-8 text-center text-white/30 text-sm">{t('export.noColumnFound')}</div>
        )}
      </div>

      {/* Preview of selected column order */}
      <AnimatePresence>
        {showPreview && selectedColumns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-4 border border-white/5 overflow-hidden"
          >
            <p className="text-xs text-white/40 mb-2 font-medium">{t('export.exportOrder')}</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_COLUMNS.filter(c => selectedColumns.includes(c.key)).map((col, i) => (
                <span key={col.key} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-xs text-white/60">
                  <span className="text-white/30">{i + 1}.</span> {t(col.labelKey)}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <button
          onClick={onNext}
          disabled={selectedColumns.length === 0}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer',
            selectedColumns.length === 0
              ? 'bg-primary/30 text-white/40 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/25'
          )}
        >
          {t('common.next')} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ColumnSelectionStep;
