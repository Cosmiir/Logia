import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Check, Loader2, Info } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { SectionTitle, Divider } from './shared';
import { tauriApi } from '@/lib/tauri-api';
import { API_KEY_SETTINGS } from '@/lib/api-providers';

const ApiKeysSection: React.FC = () => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    tauriApi.settings
      .getAll()
      .then((all) => {
        const apiKeys: Record<string, string> = {};
        for (const { key } of API_KEY_SETTINGS) {
          apiKeys[key] = all[key] ?? '';
        }
        setKeys(apiKeys);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (key: string) => {
    setSavingKey(key);
    try {
      await tauriApi.settings.update(key, keys[key] ?? '');
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <>
      <SectionTitle>{t('settings.api.title')}</SectionTitle>

      <p className="text-sm text-text-secondary mb-4 max-w-2xl">
        {t('settings.api.description')}
      </p>

      {/* Offline notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-flashy-purple/10 border border-flashy-purple/20 mb-6">
        <Info className="w-4 h-4 text-flashy-purple shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary">
          {t('settings.api.offlineNotice')}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="space-y-5">
          {API_KEY_SETTINGS.map(({ key, label, docUrl }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-white">{label}</label>
                <button
                  onClick={() => openUrl(docUrl)}
                  className="flex items-center gap-1 text-[11px] text-flashy-purple/70 hover:text-flashy-purple transition-colors"
                >
                  {t('settings.api.getKey')}
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keys[key] ?? ''}
                  onChange={(e) =>
                    setKeys((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={t('settings.api.keyPlaceholder')}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-flashy-purple/40 transition-colors"
                />
                <button
                  onClick={() => handleSave(key)}
                  disabled={savingKey === key}
                  className="px-4 py-2 rounded-lg bg-flashy-purple/20 hover:bg-flashy-purple/30 border border-flashy-purple/30 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 min-w-[90px] justify-center"
                >
                  {savingKey === key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : savedKey === key ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {t('settings.api.saved')}
                    </>
                  ) : (
                    t('settings.api.save')
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Divider />

      {/* TMDB attribution — required by their terms of service */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-white mb-2">
          {t('settings.api.attributionTitle')}
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('settings.api.tmdbAttribution')}
        </p>
      </div>
    </>
  );
};

export default ApiKeysSection;
