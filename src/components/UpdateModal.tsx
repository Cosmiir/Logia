import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { DownloadCloud, X, Loader2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { UpdateModalProps } from './UpdateModal.types';

const UpdateModal: React.FC<UpdateModalProps> = ({
  open,
  status,
  update,
  error,
  progress,
  onInstall,
  onDownloadManual,
  onIgnore,
  onSkipVersion,
  onClose,
}) => {
  const { t } = useTranslation();
  const isBusy = status === 'downloading' || status === 'installing';

  const handleManualDownload = () => {
    openUrl('https://github.com/Cosmiir/Logia/releases/latest').catch(() => {});
    onDownloadManual?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !isBusy) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md mx-4 bg-[#12141f]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <DownloadCloud className="w-4.5 h-4.5 text-primary" />
                </div>
                <h2 className="text-base font-bold text-white">
                  {status === 'not-available'
                    ? t('update.upToDate')
                    : status === 'error'
                      ? t('update.error')
                      : t('update.available')}
                </h2>
              </div>
              {!isBusy && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {status === 'available' && update && (
                <>
                  <p className="text-sm text-gray-300">
                    {t('update.version', { version: update.version })}
                  </p>
                  {update.body && (
                    <div className="max-h-40 overflow-y-auto rounded-lg bg-white/[0.03] border border-white/5 p-3">
                      <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                        {t('update.releaseNotes')}
                      </p>
                      <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                        {update.body}
                      </p>
                    </div>
                  )}
                </>
              )}

              {status === 'not-available' && (
                <div className="flex items-center gap-3 py-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  <p className="text-sm text-gray-300">{t('update.upToDateDescription')}</p>
                </div>
              )}

              {status === 'error' && (
                <div className="flex items-start gap-3 py-2">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">
                    {t('update.errorDescription')}
                    {error && <span className="block mt-1 text-[11px] text-gray-500 font-mono">{error}</span>}
                  </p>
                </div>
              )}

              {isBusy && (
                <div className="py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                    <p className="text-sm text-gray-300">
                      {status === 'downloading'
                        ? t('update.downloading', { progress })
                        : t('update.installing')}
                    </p>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${status === 'installing' ? 100 : progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {status === 'available' && update && !isBusy && (
              <div className="px-6 py-4 border-t border-white/5 space-y-2">
                <button
                  onClick={onInstall}
                  className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-sm font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <DownloadCloud className="w-4 h-4" />
                  {t('update.updateNow')}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleManualDownload}
                    className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('update.downloadManual')}
                  </button>
                  <button
                    onClick={onIgnore}
                    className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 transition-all cursor-pointer"
                  >
                    {t('update.ignore')}
                  </button>
                </div>
                <button
                  onClick={onSkipVersion}
                  className="w-full py-1.5 text-[11px] text-gray-500 hover:text-gray-400 transition-colors cursor-pointer"
                >
                  {t('update.skipVersion')}
                </button>
              </div>
            )}

            {(status === 'not-available' || status === 'error') && (
              <div className="px-6 py-4 border-t border-white/5">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 transition-all cursor-pointer"
                >
                  {t('common.ok')}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateModal;
