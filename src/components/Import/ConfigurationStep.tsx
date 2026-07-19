import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Folder, AlignJustify, ChevronRight, Info } from 'lucide-react';

interface ConfigurationStepProps {
  ratingScale: number;
  setRatingScale: (v: number) => void;
  autoCreateCollections: boolean;
  setAutoCreateCollections: (v: boolean) => void;
  autoCreateGenres: boolean;
  setAutoCreateGenres: (v: boolean) => void;
  genreSeparator: string;
  setGenreSeparator: (v: string) => void;
  roundRatings: boolean;
  setRoundRatings: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
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

const ConfigurationStep: React.FC<ConfigurationStepProps> = ({
  ratingScale, setRatingScale,
  autoCreateCollections, setAutoCreateCollections,
  autoCreateGenres, setAutoCreateGenres,
  genreSeparator, setGenreSeparator,
  roundRatings, setRoundRatings,
  onBack, onNext,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-white">{t('import.configuration')}</h2>
        <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">{t('import.oneSetting')}</span>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* LEFT COLUMN — 3/5 */}
        <div className="col-span-3 space-y-4">

          {/* Notes */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-sm font-semibold text-white">{t('import.ratingSystem')}</span>
            </div>
            <div className="p-5">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider">{t('import.sourceScale')}</label>
                  <div className="flex items-center gap-3">
                    <span className="text-white/30 text-sm">1</span>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={ratingScale}
                      onChange={(e) => setRatingScale(parseInt(e.target.value))}
                      className="flex-1 accent-primary cursor-pointer"
                    />
                    <span className="text-white/30 text-sm">100</span>
                  </div>
                </div>
                <div className="text-center min-w-[64px]">
                  <div className="text-3xl font-bold text-white tabular-nums">{ratingScale}</div>
                  <div className="text-xs text-white/30">{t('import.max')}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 p-3 bg-white/3 rounded-lg border border-white/5">
                <Info className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                <p className="text-xs text-white/40">
                  {t('import.ratingConversionHint', { scale: ratingScale })}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">{t('import.roundRatings')}</p>
                  <p className="text-xs text-white/35 mt-0.5">{t('import.roundRatingsHint')}</p>
                </div>
                <Toggle value={roundRatings} onChange={setRoundRatings} />
              </div>
            </div>
          </div>

          {/* Collections & Genres */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Folder className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-white">{t('import.collectionsAndGenres')}</span>
            </div>
            <div className="divide-y divide-white/5">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm text-white/80">{t('import.createMissingCollections')}</p>
                  <p className="text-xs text-white/35 mt-0.5">{t('import.createMissingCollectionsHint')}</p>
                </div>
                <Toggle value={autoCreateCollections} onChange={setAutoCreateCollections} />
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm text-white/80">{t('import.createMissingGenres')}</p>
                  <p className="text-xs text-white/35 mt-0.5">{t('import.createMissingGenresHint')}</p>
                </div>
                <Toggle value={autoCreateGenres} onChange={setAutoCreateGenres} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — 2/5 */}
        <div className="col-span-2">
          <div className="glass-card rounded-2xl overflow-hidden h-full">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <AlignJustify className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-white">{t('import.genreSeparator')}</span>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-white/40">{t('import.genreSeparatorHint')}</p>
              <div className="flex gap-2">
                <SeparatorOption value="," label={t('import.comma')} symbol="," current={genreSeparator} onChange={setGenreSeparator} />
                <SeparatorOption value=";" label={t('import.semicolon')} symbol=";" current={genreSeparator} onChange={setGenreSeparator} />
                <SeparatorOption value="|" label={t('import.pipe')} symbol="|" current={genreSeparator} onChange={setGenreSeparator} />
              </div>
              <div className="mt-3 p-3 bg-white/3 rounded-lg border border-white/5">
                <p className="text-xs text-white/30 mb-1">{t('common.example')}</p>
                <p className="text-xs font-mono text-white/60">
                  Action{genreSeparator} Aventure{genreSeparator} Drame
                </p>
              </div>
            </div>
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

export default ConfigurationStep;
