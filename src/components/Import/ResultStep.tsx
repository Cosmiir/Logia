import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Database, Folder, AlertOctagon, Library, RotateCcw, ChevronRight } from 'lucide-react';

interface ResultStepProps {
  importState: 'idle' | 'loading' | 'success' | 'error';
  importType: 'zip' | 'csv' | null;
  importResult: any;
  error: string | null;
  onGoToLibrary: () => void;
  onGoBack: () => void;
  onRetry: () => void;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
  accent?: boolean;
}> = ({ icon, iconBg, value, label, accent }) => (
  <div className={`glass-card rounded-xl p-5 flex items-center gap-4 ${accent ? 'ring-1 ring-primary/20' : ''}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      {icon}
    </div>
    <div>
      <div className="text-3xl font-bold text-white tabular-nums">{value.toLocaleString()}</div>
      <div className="text-sm text-white/45 mt-0.5">{label}</div>
    </div>
  </div>
);

const ResultStep: React.FC<ResultStepProps> = ({
  importState, importType, importResult, error, onGoToLibrary, onGoBack, onRetry,
}) => {
  const { t } = useTranslation();
  if (importState === 'success') {
    const hasErrors = importResult?.errors && importResult.errors.length > 0;
    const importedMedia = importResult?.imported_media || 0;
    const createdCollections = importResult?.created_collections ?? importResult?.imported_collections ?? 0;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">{t('import.resultTitle')}</h2>

        {/* Success banner */}
        <div className="glass-card rounded-2xl p-6 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{t('import.importSuccessTitle')}</h3>
            <p className="text-sm text-white/45 mt-0.5">
              {importType === 'csv' ? t('import.csvImported') : t('import.zipRestored')}
            </p>
          </div>
          {!hasErrors && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">{t('import.noErrors')}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {importType === 'csv' ? (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={<Database className="w-6 h-6 text-blue-400" />}
              iconBg="bg-blue-500/15"
              value={importedMedia}
              label={t('import.mediaImported')}
              accent
            />
            <StatCard
              icon={<Folder className="w-6 h-6 text-primary" />}
              iconBg="bg-primary/15"
              value={createdCollections}
              label={t('import.collectionsCreated')}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={<Database className="w-6 h-6 text-blue-400" />}
              iconBg="bg-blue-500/15"
              value={importedMedia}
              label={t('import.mediaRestored')}
              accent
            />
            <StatCard
              icon={<Folder className="w-6 h-6 text-primary" />}
              iconBg="bg-primary/15"
              value={createdCollections}
              label={t('import.collectionsRestored')}
            />
          </div>
        )}

        {/* Errors */}
        {hasErrors && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                <AlertOctagon className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-white">
                  {t('import.errorsCount', { count: importResult.errors.length })}
                </span>
                <span className="text-xs text-white/35 ml-2">{t('import.elementsNotImported')}</span>
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto p-3 space-y-1">
              {importResult.errors.slice(0, 15).map((err: string, i: number) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="w-1 h-1 rounded-full bg-red-400/60 mt-1.5 flex-shrink-0" />
                  <p className="text-xs text-red-400/80">{err}</p>
                </div>
              ))}
              {importResult.errors.length > 15 && (
                <p className="text-xs text-white/30 text-center py-2">
                  {t('import.moreErrors', { count: importResult.errors.length - 15 })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onGoToLibrary}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-xl transition-all cursor-pointer shadow-lg shadow-primary/25"
          >
            <Library className="w-4 h-4" />
            {t('import.goToLibrary')}
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
          <button
            onClick={onGoBack}
            className="px-5 py-3 text-sm text-white/45 hover:text-white/70 border border-white/10 hover:border-white/20 rounded-xl transition-all cursor-pointer"
          >
            {t('import.importSettings')}
          </button>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{t('import.resultTitle')}</h2>

      <div className="glass-card rounded-2xl p-8">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mb-5 ring-1 ring-red-500/20">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{t('import.importFailed')}</h3>
          <p className="text-sm text-white/45 mb-5">{t('import.importFailedDescription')}</p>

          {error && (
            <div className="w-full p-4 bg-red-500/8 border border-red-500/15 rounded-xl mb-6 text-left">
              <p className="text-xs text-red-400/80 font-mono break-all">{error}</p>
            </div>
          )}

          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-xl transition-all cursor-pointer shadow-lg shadow-primary/25"
          >
            <RotateCcw className="w-4 h-4" />
            {t('common.retry')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultStep;
