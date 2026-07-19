import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, FileText, Table2, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ExportFormat = 'csv' | 'tsv' | 'markdown';

interface FormatConfigStepProps {
  format: ExportFormat;
  setFormat: (f: ExportFormat) => void;
  delimiter: string;
  setDelimiter: (d: string) => void;
  ratingScale: number;
  setRatingScale: (s: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const FORMAT_OPTIONS = [
  {
    id: 'csv' as ExportFormat,
    icon: Table2,
    title: 'CSV',
    subtitle: 'Comma-Separated Values',
    descKey: 'export.csvDesc',
    color: 'text-emerald-400',
    accentBorder: 'border-emerald-500/50',
    accentShadow: 'shadow-emerald-500/15',
    accentBg: 'bg-emerald-400/5',
  },
  {
    id: 'tsv' as ExportFormat,
    icon: Table2,
    title: 'TSV',
    subtitle: 'Tab-Separated Values',
    descKey: 'export.tsvDesc',
    color: 'text-sky-400',
    accentBorder: 'border-sky-500/50',
    accentShadow: 'shadow-sky-500/15',
    accentBg: 'bg-sky-400/5',
  },
  {
    id: 'markdown' as ExportFormat,
    icon: FileText,
    title: 'Markdown',
    subtitle: 'Table Markdown (.md)',
    descKey: 'export.markdownDesc',
    color: 'text-violet-400',
    accentBorder: 'border-violet-500/50',
    accentShadow: 'shadow-violet-500/15',
    accentBg: 'bg-violet-400/5',
  },
];

const DELIMITERS = [
  { labelKey: 'import.semicolon', suffix: '  ;', value: ';' },
  { labelKey: 'import.comma', suffix: '  ,', value: ',' },
  { labelKey: 'import.pipe', suffix: '  |', value: '|' },
];

const RATING_SCALES = [
  { label: '/5', value: 5, example: '3.5' },
  { label: '/10', value: 10, example: '7' },
  { label: '/20', value: 20, example: '14' },
  { label: '/100', value: 100, example: '70' },
];

const FormatConfigStep: React.FC<FormatConfigStepProps> = ({
  format, setFormat, delimiter, setDelimiter,
  ratingScale, setRatingScale, onNext, onBack,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">{t('export.exportFormat')}</h2>
        <p className="text-white/50 text-sm">{t('export.exportFormatHint')}</p>
      </div>

      {/* Format cards */}
      <div className="grid grid-cols-3 gap-3">
        {FORMAT_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const selected = format === opt.id;
          return (
            <motion.button
              key={opt.id}
              onClick={() => setFormat(opt.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative text-left p-5 rounded-2xl border transition-all duration-200 cursor-pointer',
                selected
                  ? `glass-card ${opt.accentBorder} shadow-lg ${opt.accentShadow} ${opt.accentBg}`
                  : 'glass-card border-white/5 hover:border-white/15'
              )}
            >
              {selected && (
                <motion.div
                  layoutId="format-selected"
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', selected ? 'bg-white/10' : 'bg-white/5')}>
                <Icon className={cn('w-5 h-5', selected ? opt.color : 'text-white/40')} />
              </div>
              <p className={cn('text-sm font-bold mb-0.5', selected ? 'text-white' : 'text-white/70')}>{opt.title}</p>
              <p className={cn('text-xs mb-2', selected ? opt.color : 'text-white/30')}>{opt.subtitle}</p>
              <p className="text-xs text-white/30 leading-relaxed">{t(opt.descKey)}</p>
            </motion.button>
          );
        })}
      </div>

      {/* CSV delimiter (only when csv selected) */}
      {format === 'csv' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5 border border-white/5 space-y-3"
        >
          <p className="text-sm font-semibold text-white/80">{t('export.csvSeparator')}</p>
          <div className="flex gap-2">
            {DELIMITERS.map(d => (
              <button
                key={d.value}
                onClick={() => setDelimiter(d.value)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border',
                  delimiter === d.value
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                    : 'bg-white/3 border-white/5 text-white/40 hover:text-white/70 hover:border-white/15'
                )}
              >
                {t(d.labelKey)}{d.suffix}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/25">
            {t('export.excelHint')}
          </p>
        </motion.div>
      )}

      {/* Rating scale */}
      <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Hash className="w-4 h-4 text-white/40" />
          <p className="text-sm font-semibold text-white/80">{t('export.ratingScale')}</p>
        </div>
        <p className="text-xs text-white/30">{t('export.ratingScaleHint')}</p>
        <div className="grid grid-cols-4 gap-2">
          {RATING_SCALES.map(scale => (
            <button
              key={scale.value}
              onClick={() => setRatingScale(scale.value)}
              className={cn(
                'py-3 rounded-xl border transition-all cursor-pointer',
                ratingScale === scale.value
                  ? 'bg-primary/15 border-primary/50 text-primary'
                  : 'bg-white/3 border-white/5 text-white/40 hover:text-white/70 hover:border-white/15'
              )}
            >
              <p className={cn('text-base font-bold', ratingScale === scale.value ? 'text-primary' : 'text-white/60')}>{scale.label}</p>
              <p className="text-xs text-white/25 mt-0.5">{t('common.example')}: {scale.example}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> {t('common.back')}
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-primary/25"
        >
          {t('common.next')} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FormatConfigStep;
