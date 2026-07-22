import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, Github, Coffee } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import logiaLogo from '@/assets/LOGIA.png';
import { getVersion } from '@tauri-apps/api/app';
import { SectionTitle, Divider, SettingRow } from './shared';

const AboutSection: React.FC = () => {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('1.0.0');

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);
  return (
    <>
      {/* App identity */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10 shrink-0 overflow-hidden">
          <img src={logiaLogo} alt="Logia" className="w-9 h-9 object-contain" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Logia</h2>
          <p className="text-xs text-gray-400">v{appVersion}</p>
        </div>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed mb-6">
        {t('settings.about.description')}
      </p>

      <Divider />

      <SectionTitle>{t('settings.about.links')}</SectionTitle>
      <div className="space-y-1 mb-2">
        <SettingRow
          icon={Github}
          iconColor="text-gray-300"
          iconBg="bg-white/5"
          title={t('settings.about.sourceCode')}
          description={t('settings.about.viewOnGitHub')}
        >
          <button
            onClick={() => openUrl('https://github.com/Cosmiir/Logia')}
            className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >{t('settings.about.open')} &rarr;</button>
        </SettingRow>
        <SettingRow
          icon={Coffee}
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10"
          title={t('settings.about.support')}
          description={t('settings.about.supportDescription')}
        >
          <button
            onClick={() => openUrl('https://ko-fi.com/cosmiir')}
            className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
          >{t('settings.about.open')} &rarr;</button>
        </SettingRow>
      </div>

      <Divider />

      <SectionTitle>{t('settings.about.techStack')}</SectionTitle>
      <div className="space-y-2.5">
        {[
          [t('settings.about.frontend'), 'React 19 + TypeScript + TailwindCSS 4'],
          [t('settings.about.backend'), 'Tauri 2.10 (Rust)'],
          [t('settings.about.database'), 'SQLite (WAL + FTS5)'],
          [t('settings.about.state'), 'Zustand 5 + TanStack Query 5'],
          [t('settings.about.animations'), 'Framer Motion 11'],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-xs text-gray-300 font-mono">{value}</span>
          </div>
        ))}
      </div>

      <Divider />

      <div className="flex items-center gap-2 text-gray-500">
        <Heart className="w-3.5 h-3.5 text-pink-400" />
        <span className="text-xs">{t('settings.about.builtWithLove')}</span>
      </div>
    </>
  );
};

export default AboutSection;
