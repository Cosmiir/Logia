import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import i18n from 'i18next';
import * as Flags from 'country-flag-icons/react/3x2';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';

interface LanguageStepProps {
  onNext: () => void;
}

const languages = [
  { code: 'en', label: 'English', flag: 'GB' },
  { code: 'fr', label: 'Français', flag: 'FR' },
];

function FlagIcon({ code, size = 48 }: { code: string; size?: number }) {
  const FlagComp = (Flags as Record<string, React.FC<{ title?: string; className?: string }>>)[code];
  if (!FlagComp) return null;
  return (
    <span style={{ width: size, height: size * 0.67 }} className="inline-flex shrink-0 rounded-md overflow-hidden shadow-lg">
      <FlagComp className="w-full h-full" />
    </span>
  );
}

const LanguageStep: React.FC<LanguageStepProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const language = useProfileSettingsStore((s) => s.language);
  const setLanguage = useProfileSettingsStore((s) => s.setLanguage);

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    setLanguage(code);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-white">{t('onboarding.language.title')}</h2>
        <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          {t('onboarding.language.stepLabel')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={`flex flex-col items-center gap-3 py-8 rounded-2xl border transition-all duration-200 cursor-pointer ${
              language === lang.code
                ? 'bg-primary/10 border-primary/30 ring-2 ring-primary/20'
                : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/10'
            }`}
          >
            <FlagIcon code={lang.flag} size={48} />
            <span className={`text-sm font-medium ${language === lang.code ? 'text-white' : 'text-gray-400'}`}>
              {lang.label}
            </span>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          className="px-6 py-2.5 text-white text-sm rounded-lg transition-all shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90 cursor-pointer flex items-center gap-2"
        >
          {t('common.continue')} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default LanguageStep;
