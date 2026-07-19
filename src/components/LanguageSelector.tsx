import React from 'react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useProfileSettingsStore } from '@/hooks/useProfileSettingsStore';

interface LanguageSelectorProps {
  showLabel?: boolean;
}

const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ showLabel = true }) => {
  const { t } = useTranslation();
  const language = useProfileSettingsStore((s) => s.language);
  const setLanguage = useProfileSettingsStore((s) => s.setLanguage);

  const handleChange = (code: string) => {
    i18n.changeLanguage(code);
    setLanguage(code);
  };

  return (
    <div className="flex items-center gap-3">
      {showLabel && (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Globe className="w-4 h-4" />
          <span>{t('common.language')}</span>
        </div>
      )}
      <div className="flex gap-2">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
              language === lang.code
                ? 'bg-primary/15 border-primary/40 text-white'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;
