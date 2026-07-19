import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionTitle, Divider } from './shared';

const ShortcutsSection: React.FC = () => {
  const { t } = useTranslation();
  const shortcuts = [
    { keys: ['Ctrl', 'N'], action: t('settings.shortcuts.addMedia') },
    { keys: ['Ctrl', 'F'], action: t('settings.shortcuts.search') },
    { keys: ['Ctrl', ','], action: t('settings.shortcuts.openSettings') },
    { keys: ['Ctrl', 'D'], action: t('settings.shortcuts.goToDashboard') },
    { keys: ['Ctrl', 'L'], action: t('settings.shortcuts.goToLibrary') },
    { keys: ['Esc'], action: t('settings.shortcuts.closeModal') },
  ];

  return (
    <>
      <SectionTitle>{t('settings.shortcuts.title')}</SectionTitle>
      <div className="space-y-2">
        {shortcuts.map((shortcut, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-b-0">
            <span className="text-sm text-gray-300">{shortcut.action}</span>
            <div className="flex items-center gap-1.5">
              {shortcut.keys.map((key) => (
                <kbd
                  key={key}
                  className="px-2.5 py-1 bg-white/[0.06] border border-white/10 rounded-md text-[11px] font-mono text-gray-300 min-w-[28px] text-center"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Divider />

      <p className="text-[11px] text-gray-500 leading-relaxed">
        {t('settings.shortcuts.notCustomizable')}
      </p>
    </>
  );
};

export default ShortcutsSection;
