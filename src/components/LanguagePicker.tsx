import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import * as Flags from 'country-flag-icons/react/3x2';

interface LanguagePickerProps {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

interface LanguageOption {
  code: string;
  label: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'en', label: 'English', flag: 'GB' },
  { code: 'en-US', label: 'English (US)', flag: 'US' },
  { code: 'ja', label: '日本語', flag: 'JP' },
  { code: 'ko', label: '한국어', flag: 'KR' },
  { code: 'es', label: 'Español', flag: 'ES' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'it', label: 'Italiano', flag: 'IT' },
  { code: 'pt', label: 'Português', flag: 'PT' },
  { code: 'pt-BR', label: 'Português (BR)', flag: 'BR' },
  { code: 'zh', label: '中文', flag: 'CN' },
  { code: 'zh-TW', label: '中文 (繁體)', flag: 'TW' },
  { code: 'ru', label: 'Русский', flag: 'RU' },
  { code: 'ar', label: 'العربية', flag: 'SA' },
  { code: 'hi', label: 'हिन्दी', flag: 'IN' },
  { code: 'tr', label: 'Türkçe', flag: 'TR' },
  { code: 'nl', label: 'Nederlands', flag: 'NL' },
  { code: 'pl', label: 'Polski', flag: 'PL' },
  { code: 'sv', label: 'Svenska', flag: 'SE' },
  { code: 'no', label: 'Norsk', flag: 'NO' },
  { code: 'da', label: 'Dansk', flag: 'DK' },
  { code: 'fi', label: 'Suomi', flag: 'FI' },
  { code: 'cs', label: 'Čeština', flag: 'CZ' },
  { code: 'th', label: 'ไทย', flag: 'TH' },
  { code: 'vi', label: 'Tiếng Việt', flag: 'VN' },
  { code: 'id', label: 'Indonesia', flag: 'ID' },
  { code: 'el', label: 'Ελληνικά', flag: 'GR' },
  { code: 'he', label: 'עברית', flag: 'IL' },
  { code: 'hu', label: 'Magyar', flag: 'HU' },
  { code: 'ro', label: 'Română', flag: 'RO' },
  { code: 'uk', label: 'Українська', flag: 'UA' },
  { code: 'ca', label: 'Català', flag: 'ES' },
];

function FlagIcon({ code, size = 16 }: { code: string; size?: number }) {
  const FlagComp = (Flags as Record<string, React.FC<{ title?: string; className?: string }>>)[code];
  if (!FlagComp) return <span className="text-[9px] text-white/40">{code}</span>;
  return (
    <span style={{ width: size, height: size * 0.67 }} className="inline-flex shrink-0 rounded-sm overflow-hidden">
      <FlagComp className="w-full h-full" />
    </span>
  );
}

const LanguagePicker: React.FC<LanguagePickerProps> = ({ value, onChange, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLanguage = useMemo(
    () => LANGUAGES.find((l) => l.code === value),
    [value]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return LANGUAGES;
    const q = search.toLowerCase();
    return LANGUAGES.filter(
      (l) => l.label.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        }`}
      >
        {value && selectedLanguage ? (
          <>
            <FlagIcon code={selectedLanguage.flag} size={14} />
            <span className="truncate max-w-[70px]">{selectedLanguage.label}</span>
          </>
        ) : value ? (
          <span className="truncate max-w-[80px]">{value}</span>
        ) : (
          <span className="text-white/30 text-xs">—</span>
        )}
        {!compact && value && (
          <X className="w-3 h-3 text-white/30 hover:text-white/60 transition-colors" onClick={handleClear} />
        )}
        <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                autoFocus
                className="w-full pl-8 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary/30"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer ${
                    value === lang.code
                      ? 'bg-primary/15 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <FlagIcon code={lang.flag} size={16} />
                  <span className="flex-1 text-left truncate">{lang.label}</span>
                  {value === lang.code && <span className="text-primary text-[10px]">✓</span>}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-xs text-white/30 text-center">
                No language found. You can type a custom value.
              </div>
            )}
            {search.trim() && !filtered.some((l) => l.code === search.trim()) && (
              <button
                type="button"
                onClick={() => handleSelect(search.trim())}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border-t border-white/5"
              >
                <span className="text-[9px] text-white/40">??</span>
                <span className="flex-1 text-left">Use "{search.trim()}"</span>
              </button>
            )}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className="w-full px-3 py-2 text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer border-t border-white/5"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LanguagePicker;
