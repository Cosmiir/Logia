import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, ChevronRight, Info } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { dataApi } from '@/lib/tauri-api';

interface StorageStepProps {
  storagePath: string | null;
  setStoragePath: (path: string | null) => void;
  onNext: () => void;
}

const StorageStep: React.FC<StorageStepProps> = ({ storagePath, setStoragePath, onNext }) => {
  const { t } = useTranslation();
  const [storagePathError, setStoragePathError] = useState('');
  const [defaultStoragePath, setDefaultStoragePath] = useState<string>('');

  useEffect(() => {
    // Load the default storage path on mount
    dataApi.getStoragePath().then(path => {
      setDefaultStoragePath(path);
    }).catch(() => {
      // If we can't get the path, leave it empty
    });
  }, []);

  const handleSelectStoragePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('onboarding.storage.selectFolderTitle'),
      });
      if (selected && typeof selected === 'string') {
        setStoragePathError('');
        try {
          const isValid = await dataApi.verifyStoragePath(selected);
          if (isValid) {
            setStoragePath(selected);
          } else {
            setStoragePathError(t('onboarding.storage.writeError'));
          }
        } catch (e) {
          setStoragePathError(String(e));
        }
      }
    } catch (e) {
      setStoragePathError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-white">{t('settings.profile.storage')}</h2>
        <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">{t('onboarding.storage.stepLabel')}</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-white">{t('settings.profile.storage')}</span>
        </div>
        <div className="p-5">
          <button
            type="button"
            onClick={handleSelectStoragePath}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-left text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors hover:border-white/20 flex items-center gap-3 !cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">
              {storagePath || (defaultStoragePath ? `${t('onboarding.storage.defaultFolder')}: ${defaultStoragePath}` : t('onboarding.storage.selectFolder'))}
            </span>
          </button>
          {storagePathError && <p className="text-xs text-red-400 mt-1.5">{storagePathError}</p>}
          
          <div className="mt-4 flex items-start gap-2 p-3 bg-white/3 rounded-lg border border-white/5">
            <Info className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/40">
              {storagePath 
                ? t('onboarding.storage.dataStoredHere')
                : t('onboarding.storage.defaultUsed')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition-all cursor-pointer shadow-lg shadow-primary/25 flex items-center gap-2"
        >
          {t('common.next')} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default StorageStep;
