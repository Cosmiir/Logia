import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronLeft, LayoutGrid, Grid2X2, List, Grid3X3, Loader2 } from 'lucide-react';
import { THEMES } from '@/lib/themes';
import type { CardDensity } from '@/stores/useSettingsStore';
import { useTheme } from '@/contexts/ThemeContext';

interface PersonalizationStepProps {
  themeId: string;
  setThemeId: (id: string) => void;
  cardDensity: CardDensity;
  setCardDensity: (density: CardDensity) => void;
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;
  onBack: () => void;
  onComplete: () => void;
  isSubmitting?: boolean;
}

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className={`relative w-12 h-6 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 ${
      value ? 'bg-primary shadow-lg shadow-primary/40' : 'bg-white/10'
    }`}
  >
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${
      value ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'
    }`} />
  </button>
);

const PersonalizationStep: React.FC<PersonalizationStepProps> = ({
  themeId,
  setThemeId,
  cardDensity,
  setCardDensity,
  animationsEnabled,
  setAnimationsEnabled,
  onBack,
  onComplete,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const { setThemeId: setThemeIdContext } = useTheme();

  const densityOptions: { id: CardDensity; label: string; icon: React.ElementType }[] = [
    { id: 'compact', label: t('onboarding.personalization.compact'), icon: Grid3X3 },
    { id: 'normal', label: t('onboarding.personalization.normal'), icon: LayoutGrid },
    { id: 'large', label: t('onboarding.personalization.large'), icon: Grid2X2 },
    { id: 'detailed', label: t('onboarding.personalization.detailed'), icon: List },
  ];

  const handleThemeSelect = (selectedThemeId: string) => {
    setThemeId(selectedThemeId);
    setThemeIdContext(selectedThemeId);
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-white">{t('onboarding.personalization.title')}</h2>
        <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">{t('onboarding.personalization.stepLabel')}</span>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* LEFT COLUMN — 3/5 */}
        <div className="col-span-3 space-y-4">
          {/* Theme */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-white">{t('onboarding.personalization.theme')}</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-5 gap-3">
                {THEMES.map((theme) => {
                  const isActive = themeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeSelect(theme.id)}
                      className={`relative flex flex-col items-center gap-2.5 py-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-primary/10 border-primary/30 ring-2 ring-primary/20'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div
                        className="w-full h-12 rounded-lg mb-1"
                        style={{ background: theme.gradient }}
                      />
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
            </div>
          </div>

          {/* Card Density */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-white">{t('onboarding.personalization.density')}</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-4 gap-3 mb-2">
                {densityOptions.map((opt) => {
                  const isActive = cardDensity === opt.id;
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
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
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
              <p className="text-[11px] text-gray-500">{t('onboarding.personalization.densityHint')}</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — 2/5 */}
        <div className="col-span-2">
          <div className="glass-card rounded-2xl overflow-hidden h-full">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-white">{t('onboarding.personalization.animations')}</span>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">{t('onboarding.personalization.interfaceAnimations')}</p>
                  <p className="text-xs text-white/35 mt-0.5">{t('onboarding.personalization.transitionsHint')}</p>
                </div>
                <Toggle value={animationsEnabled} onChange={setAnimationsEnabled} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <button
          onClick={handleComplete}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/80 rounded-xl text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('onboarding.finish')}
        </button>
      </div>
    </div>
  );
};

export default PersonalizationStep;
