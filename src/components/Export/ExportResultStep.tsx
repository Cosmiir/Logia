import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, FileDown, RotateCcw, ArrowLeft, HardDrive, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface ExportResultStepProps {
  exportType: 'zip' | 'csv';
  result: {
    path: string;
    size_bytes: number;
    exported_media?: number;
  } | null;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}

const ExportResultStep: React.FC<ExportResultStepProps> = ({
  exportType, result, error, onRetry, onBack,
}) => {
  const { t } = useTranslation();
  const isSuccess = !!result && !error;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="glass-card rounded-2xl p-10 text-center border border-white/5"
      >
        {isSuccess ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 12 }}
              className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('export.exportSuccess')}</h2>
            <p className="text-white/40 text-sm mb-8">
              {exportType === 'zip'
                ? t('export.zipSuccess')
                : t('export.csvSuccess')}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {result!.exported_media !== undefined && (
                <div className="p-4 rounded-xl bg-white/3 border border-white/5">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Film className="w-4 h-4 text-primary/60" />
                    <span className="text-xs text-white/40">{t('export.exportedMedia')}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{result!.exported_media}</p>
                </div>
              )}
              <div className={cn('p-4 rounded-xl bg-white/3 border border-white/5', result!.exported_media === undefined && 'col-span-2')}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <HardDrive className="w-4 h-4 text-white/30" />
                  <span className="text-xs text-white/40">{t('export.fileSize')}</span>
                </div>
                <p className="text-2xl font-bold text-white">{formatBytes(result!.size_bytes)}</p>
              </div>
            </div>

            {/* File path */}
            <div className="p-3 rounded-xl bg-white/3 border border-white/5 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <FileDown className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <p className="text-xs text-white/30">{t('export.fileSaved')}</p>
              </div>
              <p className="text-xs text-white/60 font-mono break-all text-left">{result!.path}</p>
            </div>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 12 }}
              className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6"
            >
              <XCircle className="w-10 h-10 text-red-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('export.exportFailed')}</h2>
            <p className="text-white/40 text-sm mb-6">{t('export.exportFailedDesc')}</p>
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 text-left">
                <p className="text-red-400 text-xs font-mono break-all">{error}</p>
              </div>
            )}
          </>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> {t('export.backToHome')}
          </button>
          {!isSuccess && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-primary/25"
            >
              <RotateCcw className="w-4 h-4" /> {t('common.retry')}
            </button>
          )}
          {isSuccess && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> {t('export.newExport')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ExportResultStep;
