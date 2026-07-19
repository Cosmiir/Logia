import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlignJustify, ChevronRight, Info } from 'lucide-react';

interface SeparatorSelectionStepProps {
  csvDelimiter: string;
  setCsvDelimiter: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const SeparatorOption: React.FC<{
  value: string;
  label: string;
  symbol: string;
  current: string;
  onChange: (v: string) => void;
}> = ({ value, label, symbol, current, onChange }) => (
  <button
    onClick={() => onChange(value)}
    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
      current === value
        ? 'border-primary/50 bg-primary/10 shadow-lg shadow-primary/10'
        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
    }`}
  >
    <span className={`text-2xl font-mono font-bold transition-colors ${
      current === value ? 'text-primary' : 'text-white/50'
    }`}>{symbol}</span>
    <span className={`text-xs transition-colors ${
      current === value ? 'text-white/80' : 'text-white/40'
    }`}>{label}</span>
  </button>
);

const SeparatorSelectionStep: React.FC<SeparatorSelectionStepProps> = ({
  csvDelimiter,
  setCsvDelimiter,
  onBack,
  onNext,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-white">{t('import.csvSeparator')}</h2>
        <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">{t('import.oneSetting')}</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <AlignJustify className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-semibold text-white">{t('import.columnSeparator')}</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-white/40">{t('import.columnSeparatorHint')}</p>
          <div className="flex gap-2">
            <SeparatorOption value="," label={t('import.comma')} symbol="," current={csvDelimiter} onChange={setCsvDelimiter} />
            <SeparatorOption value=";" label={t('import.semicolon')} symbol=";" current={csvDelimiter} onChange={setCsvDelimiter} />
            <SeparatorOption value="\t" label={t('import.tab')} symbol="⇥" current={csvDelimiter} onChange={setCsvDelimiter} />
            <SeparatorOption value="|" label={t('import.pipe')} symbol="|" current={csvDelimiter} onChange={setCsvDelimiter} />
          </div>
          <div className="mt-3 p-3 bg-white/3 rounded-lg border border-white/5">
            <p className="text-xs text-white/30 mb-1">{t('common.example')}</p>
            <p className="text-xs font-mono text-white/60">
              Titre{csvDelimiter === '\t' ? '⇥' : csvDelimiter} Auteur{csvDelimiter === '\t' ? '⇥' : csvDelimiter} Année
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 p-3 bg-white/3 rounded-lg border border-white/5">
            <Info className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <p className="text-xs text-white/40">
              {t('import.separatorHint')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onBack} className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer">
          {t('common.back')}
        </button>
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

export default SeparatorSelectionStep;
