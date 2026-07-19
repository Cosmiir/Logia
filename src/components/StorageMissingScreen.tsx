import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FolderOpen, RefreshCw, Home } from 'lucide-react';
import { dataApi } from '@/lib/tauri-api';
import { open } from '@tauri-apps/plugin-dialog';
import TitleBar from './TitleBar';

export default function StorageMissingScreen({ storagePath, hasConfig }: { storagePath: string; hasConfig: boolean }) {
  const { t } = useTranslation();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    try {
      const success = await dataApi.retryStorageConnection();
      if (!success) {
        setError(t('storageMissing.storageStillInaccessible'));
      }
      // On success, the storage-status-changed event will refresh the state
    } catch (e) {
      setError(String(e));
    } finally {
      setIsRetrying(false);
    }
  };

  const handleChangeLocation = async () => {
    setError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('storageMissing.selectNewStorageFolder'),
      });
      if (selected && typeof selected === 'string') {
        setIsChanging(true);
        try {
          await dataApi.setStoragePath(selected);
          // Reload to reinitialize with the new storage
          window.location.reload();
        } catch (e) {
          setError(String(e));
        } finally {
          setIsChanging(false);
        }
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const handleReset = async () => {
    if (!confirm(t('storageMissing.confirmReset'))) {
      return;
    }
    setIsResetting(true);
    setError(null);
    try {
      await dataApi.resetToDefaultStorage();
      // Reload to reinitialize
      window.location.reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-fixed font-display select-none">
      <TitleBar />
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-6 w-[400px]">
          <AlertTriangle className="w-12 h-12 text-red-500/60" />
          <div className="text-center">
            <h2 className="text-lg font-bold text-white mb-2">{t('storageMissing.title')}</h2>
            <p className="text-xs text-white/40 mb-4">
              {hasConfig
                ? t('storageMissing.descriptionWithConfig')
                : t('storageMissing.descriptionWithoutConfig')
              }
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleRetry}
              disabled={isRetrying || isChanging || isResetting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {t('storageMissing.retry')}
            </button>
            <button
              onClick={handleChangeLocation}
              disabled={isRetrying || isChanging || isResetting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FolderOpen className="w-4 h-4" />
              {t('storageMissing.changeLocation')}
            </button>
            <button
              onClick={handleReset}
              disabled={isRetrying || isChanging || isResetting}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-sm font-semibold text-red-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Home className="w-4 h-4" />
              {t('storageMissing.resetToAppData')}
            </button>
          </div>

          {storagePath && (
            <p className="text-[10px] text-gray-600 text-center mt-2">
              {t('storageMissing.configuredFolder')} : {storagePath}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
