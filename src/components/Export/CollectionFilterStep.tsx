import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, Layers, Check, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { save } from '@tauri-apps/plugin-dialog';
import { tauriApi } from '@/lib/tauri-api';
import type { Collection, CsvExportRequest } from '@/types';
import type { ExportFormat } from './FormatConfigStep';

interface CollectionFilterStepProps {
  collections: Collection[];
  selectedColumns: string[];
  format: ExportFormat;
  delimiter: string;
  ratingScale: number;
  onSuccess: (result: { path: string; exported_media: number; size_bytes: number }) => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

const CollectionFilterStep: React.FC<CollectionFilterStepProps> = ({
  collections, selectedColumns, format, delimiter, ratingScale,
  onSuccess, onError, onBack,
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [exportAll, setExportAll] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const toggleCollection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getExtension = () => format === 'markdown' ? 'md' : format === 'tsv' ? 'tsv' : 'csv';

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const ext = getExtension();
      const destPath = await save({
        filters: [{ name: t('export.fileType', { ext: ext.toUpperCase() }), extensions: [ext] }],
        defaultPath: `logia_export_${new Date().toISOString().slice(0, 10)}.${ext}`,
      });
      if (!destPath) { setIsExporting(false); return; }
      const request: CsvExportRequest = {
        destination_path: destPath,
        columns: selectedColumns,
        collection_ids: exportAll ? undefined : selectedIds,
        format,
        rating_scale: ratingScale,
        delimiter: format === 'csv' ? delimiter : undefined,
      };
      const result = await tauriApi.data.exportToCsvOrMarkdown(request);
      onSuccess(result);
    } catch (e) {
      onError(String(e));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">{t('export.filterByCollection')}</h2>
        <p className="text-white/50 text-sm">{t('export.filterByCollectionHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { val: true, icon: Layers, color: 'text-primary', border: 'border-primary/50', shadow: 'shadow-primary/15', bg: 'bg-primary/5', title: t('export.allCollectionsExport'), desc: t('export.allCollectionsExportDesc') },
          { val: false, icon: Check, color: 'text-violet-400', border: 'border-violet-500/50', shadow: 'shadow-violet-500/15', bg: 'bg-violet-400/5', title: t('export.specificCollections'), desc: t('export.specificCollectionsDesc') },
        ].map(opt => {
          const Icon = opt.icon;
          const isSelected = exportAll === opt.val;
          return (
            <motion.button key={String(opt.val)} onClick={() => setExportAll(opt.val)} whileTap={{ scale: 0.98 }}
              className={cn('p-5 rounded-2xl border text-left transition-all cursor-pointer glass-card',
                isSelected ? `${opt.border} shadow-lg ${opt.shadow} ${opt.bg}` : 'border-white/5 hover:border-white/15')}>
              {isSelected && (
                <motion.div layoutId="filter-check" className="float-right w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </motion.div>
              )}
              <Icon className={cn('w-8 h-8 mb-3', isSelected ? opt.color : 'text-white/30')} />
              <p className={cn('font-semibold text-sm mb-1', isSelected ? 'text-white' : 'text-white/60')}>{opt.title}</p>
              <p className="text-xs text-white/30">{opt.desc}</p>
            </motion.button>
          );
        })}
      </div>

      {!exportAll && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-white/60">{t('export.availableCollections')}</p>
            <div className="flex gap-2">
              <button onClick={() => setSelectedIds(collections.map(c => c.id))} className="text-xs text-primary hover:text-primary-light transition-colors cursor-pointer">{t('common.all')}</button>
              <span className="text-white/20">·</span>
              <button onClick={() => setSelectedIds([])} className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer">{t('common.none')}</button>
            </div>
          </div>
          <div className="divide-y divide-white/5 max-h-[240px] overflow-y-auto custom-scrollbar">
            {collections.map(col => {
              const isSel = selectedIds.includes(col.id);
              return (
                <button key={col.id} onClick={() => toggleCollection(col.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors cursor-pointer">
                  <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all', isSel ? 'bg-primary border-primary' : 'border-white/20')}>
                    {isSel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                  <span className={cn('text-sm flex-1 text-left', isSel ? 'text-white' : 'text-white/60')}>{col.name}</span>
                </button>
              );
            })}
          </div>
          {selectedIds.length === 0 && (
            <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/10">
              <p className="text-xs text-amber-400/80">{t('export.noCollectionSelected')}</p>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 text-xs text-white/40">
        <Download className="w-4 h-4 shrink-0" />
        {t('export.formatLabel')} : <span className="text-white/70 font-medium uppercase">{format}</span>
        {format === 'csv' && <> · {t('export.separatorLabel')} : <span className="text-white/70 font-mono">{delimiter}</span></>}
        · {t('export.ratingLabel')} : <span className="text-white/70 font-medium">/{ratingScale}</span>
        · <span className="text-white/70 font-medium">{selectedColumns.length}</span> {t('export.columnsLabel')}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all cursor-pointer">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <motion.button
          onClick={handleExport}
          disabled={isExporting || (!exportAll && selectedIds.length === 0)}
          whileHover={!isExporting ? { scale: 1.02 } : {}}
          whileTap={!isExporting ? { scale: 0.98 } : {}}
          className={cn('flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer',
            isExporting || (!exportAll && selectedIds.length === 0)
              ? 'bg-primary/30 text-white/40 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/25')}
        >
          {isExporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('export.exporting')}</>
            : <><Download className="w-4 h-4" /> {t('export.chooseLocationAndExport')}<ChevronRight className="w-4 h-4" /></>}
        </motion.button>
      </div>
    </div>
  );
};

export default CollectionFilterStep;
