import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Database, Image, HardDrive, ShieldCheck, Archive, ChevronRight, Loader2, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { save } from '@tauri-apps/plugin-dialog';
import { tauriApi } from '@/lib/tauri-api';
import type { StorageInfo, ExportResult } from '@/types';

interface ZipExportStepProps {
  storageInfo: StorageInfo | null;
  onSuccess: (result: ExportResult) => void;
  onError: (msg: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const ZipExportStep: React.FC<ZipExportStepProps> = ({ storageInfo, onSuccess, onError }) => {
  const { t } = useTranslation();
  const [exportLevel, setExportLevel] = useState<'db' | 'images' | 'full'>('images');
  const [isExporting, setIsExporting] = useState(false);

  const options = [
    {
      id: 'db' as const,
      icon: Database,
      title: t('export.dbOnly'),
      description: t('export.dbOnlyDesc'),
      size: storageInfo ? formatBytes(storageInfo.db_size_bytes) : '—',
      badge: t('export.light'),
      badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      accentColor: 'border-indigo-500/60 shadow-indigo-500/20',
      iconColor: 'text-indigo-400',
    },
    {
      id: 'images' as const,
      icon: Image,
      title: t('export.dbAndImages'),
      description: t('export.dbAndImagesDesc'),
      size: storageInfo ? formatBytes(storageInfo.db_size_bytes + storageInfo.images_size_bytes) : '—',
      badge: t('common.recommended'),
      badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
      accentColor: 'border-sky-500/60 shadow-sky-500/20',
      iconColor: 'text-sky-400',
    },
    {
      id: 'full' as const,
      icon: Archive,
      title: t('export.fullBackup'),
      description: t('export.fullBackupDesc'),
      size: storageInfo ? formatBytes(storageInfo.total_size_bytes) : '—',
      badge: t('export.complete'),
      badgeColor: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
      accentColor: 'border-violet-500/60 shadow-violet-500/20',
      iconColor: 'text-violet-400',
    },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const destPath = await save({
        filters: [{ name: 'Archive ZIP', extensions: ['zip'] }],
        defaultPath: `logia_backup_${new Date().toISOString().slice(0, 10)}.zip`,
      });
      if (!destPath) { setIsExporting(false); return; }

      const includeImages = exportLevel !== 'db';
      const includeAttachments = exportLevel === 'full';

      const result = await tauriApi.data.exportDatabase(destPath, includeImages, includeAttachments);
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
        <h2 className="text-2xl font-bold text-white mb-1">{t('export.zipBackup')}</h2>
        <p className="text-white/50 text-sm">{t('export.zipBackupHint')}</p>
      </div>

      {/* Stats banner */}
      {storageInfo && (
        <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-white/50" />
            </div>
            <div>
              <p className="text-xs text-white/40">{t('export.totalMedia')}</p>
              <p className="text-sm font-semibold text-white">{storageInfo.total_media}</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Database className="w-4 h-4 text-white/50" />
            </div>
            <div>
              <p className="text-xs text-white/40">{t('export.dbSize')}</p>
              <p className="text-sm font-semibold text-white">{formatBytes(storageInfo.db_size_bytes)}</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Image className="w-4 h-4 text-white/50" />
            </div>
            <div>
              <p className="text-xs text-white/40">{t('export.imagesSize')}</p>
              <p className="text-sm font-semibold text-white">{formatBytes(storageInfo.images_size_bytes)}</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Paperclip className="w-4 h-4 text-white/50" />
            </div>
            <div>
              <p className="text-xs text-white/40">{t('export.attachmentsSize')}</p>
              <p className="text-sm font-semibold text-white">{formatBytes(storageInfo.attachments_size_bytes)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mode cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = exportLevel === opt.id;
          return (
            <motion.button
              key={opt.id}
              onClick={() => setExportLevel(opt.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                'relative text-left p-6 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-full',
                selected
                  ? `glass-card ${opt.accentColor} shadow-lg`
                  : 'glass-card border-white/5 hover:border-white/15'
              )}
            >
              {/* Selected indicator */}
              {selected && (
                <motion.div
                  layoutId="zip-selected"
                  className="absolute top-4 right-4 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                  initial={false}
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}

              <div>
                <div className={cn('w-12 h-12 rounded-xl mb-4 flex items-center justify-center', selected ? 'bg-white/10' : 'bg-white/5')}>
                  <Icon className={cn('w-6 h-6', selected ? opt.iconColor : 'text-white/40')} />
                </div>

                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className={cn('font-semibold text-sm', selected ? 'text-white' : 'text-white/70')}>
                    {opt.title}
                  </h3>
                </div>

                <p className="text-xs text-white/40 leading-relaxed mb-6">{opt.description}</p>
              </div>

              <div className="flex items-center justify-between w-full pt-2 border-t border-white/5">
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0', opt.badgeColor)}>
                  {opt.badge}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-white/50 font-semibold tabular-nums">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>~{opt.size}</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/5">
        <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-white/40 leading-relaxed">
          {t('export.securityNote')}
        </p>
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <motion.button
          onClick={handleExport}
          disabled={isExporting}
          whileHover={!isExporting ? { scale: 1.02 } : {}}
          whileTap={!isExporting ? { scale: 0.98 } : {}}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer',
            isExporting
              ? 'bg-primary/40 text-white/50 cursor-not-allowed'
              : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/25'
          )}
        >
          {isExporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t('export.exporting')}</>
          ) : (
            <><Archive className="w-4 h-4" /> {t('export.chooseLocationAndExport')}<ChevronRight className="w-4 h-4" /></>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default ZipExportStep;