import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles, LayoutGrid, Grid2X2, List, Grid3X3 } from 'lucide-react';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';
import type { CardDensity, WindowControlsStyle } from '@/stores/useSettingsStore';
import { THEMES } from '@/lib/themes';
import LanguageSelector from '@/components/LanguageSelector';
import { SectionTitle, Divider, SettingRow, Toggle } from './shared';

const PersonalizationSection: React.FC = () => {
  const { t } = useTranslation();
  const personalization = useProfileSettingsStore((s) => s.personalization);
  const setThemeId = useProfileSettingsStore((s) => s.setThemeId);
  const setCardDensity = useProfileSettingsStore((s) => s.setCardDensity);
  const setAnimationsEnabled = useProfileSettingsStore((s) => s.setAnimationsEnabled);
  const setWindowControlsStyle = useProfileSettingsStore((s) => s.setWindowControlsStyle);

  const densityOptions: { id: CardDensity; label: string; icon: React.ElementType }[] = [
    { id: 'compact', label: t('personalization.density.compact'), icon: Grid3X3 },
    { id: 'normal', label: t('personalization.density.normal'), icon: LayoutGrid },
    { id: 'large', label: t('personalization.density.large'), icon: Grid2X2 },
    { id: 'detailed', label: t('personalization.density.detailed'), icon: List },
  ];

  return (
    <>
      <SectionTitle>{t('personalization.theme')}</SectionTitle>
      <div className="mb-6">
        <LanguageSelector />
      </div>
      <Divider />
      <div className="grid grid-cols-5 gap-3 mb-6">
        {THEMES.map((theme) => {
          const isActive = personalization.themeId === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => setThemeId(theme.id)}
              className={`relative flex flex-col items-center gap-2.5 py-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-primary/10 border-primary/30 ring-2 ring-primary/20'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
              }`}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              {/* Gradient preview */}
              <div
                className="w-full h-12 rounded-lg mb-1"
                style={{ background: theme.gradient }}
              />
              {/* Accent color dot */}
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: theme.accent }}
              />
              <span className={`text-[11px] font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {theme.name}
              </span>
            </button>
          );
        })}
      </div>

      <SectionTitle>{t('personalization.cardDensity')}</SectionTitle>
      <div className="grid grid-cols-4 gap-3 mb-2">
        {densityOptions.map((opt) => {
          const isActive = personalization.cardDensity === opt.id;
          const DIcon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => setCardDensity(opt.id)}
              className={`relative flex flex-col items-center gap-2.5 py-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
              }`}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <DIcon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
              <span className={`text-[11px] font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500">{t('personalization.cardDensityHint')}</p>

      <Divider />

      <SectionTitle>{t('personalization.animations')}</SectionTitle>
      <SettingRow
        icon={Sparkles}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        title={t('personalization.interfaceAnimations')}
        description={t('personalization.interfaceAnimationsHint')}
      >
        <Toggle
          enabled={personalization.animationsEnabled}
          onToggle={() => setAnimationsEnabled(!personalization.animationsEnabled)}
        />
      </SettingRow>

      <Divider />

      <SectionTitle>{t('personalization.windowButtons')}</SectionTitle>
      <p className="text-[11px] text-gray-500 mb-3">{t('personalization.windowButtonsHint')}</p>
      <div className="grid grid-cols-3 gap-3 mb-2">
        {([
          { id: 'windows' as WindowControlsStyle, label: 'Windows', preview: (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-[1px] bg-gray-400" />
              <div className="w-2.5 h-2.5 border border-gray-400 rounded-[1px]" />
              <span className="text-gray-400 text-[10px] font-bold leading-none">&times;</span>
            </div>
          )},
          { id: 'macos' as WindowControlsStyle, label: 'macOS', preview: (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
          )},
          { id: 'hybrid' as WindowControlsStyle, label: 'Hybride', preview: (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57] flex items-center justify-center"><span className="text-[6px] text-black/50 font-bold">&times;</span></div>
              <div className="w-3 h-3 rounded-full bg-[#febc2e] flex items-center justify-center"><span className="text-[7px] text-black/50 font-bold">-</span></div>
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
          )},
        ]).map((opt) => {
          const isActive = personalization.windowControlsStyle === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setWindowControlsStyle(opt.id)}
              className={`relative flex flex-col items-center gap-2.5 py-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
              }`}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <div className="flex items-center justify-center h-5">
                {opt.preview}
              </div>
              <span className={`text-[11px] font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default PersonalizationSection;
