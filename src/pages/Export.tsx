import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Archive, FileText, Upload, Columns, Settings, Filter, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { tauriApi } from '@/lib/tauri-api';
import { useQuery } from '@tanstack/react-query';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import Stepper, { Step } from '@/components/Stepper';
import ZipExportStep from '@/components/Export/ZipExportStep';
import ColumnSelectionStep from '@/components/Export/ColumnSelectionStep';
import FormatConfigStep from '@/components/Export/FormatConfigStep';
import type { ExportFormat } from '@/components/Export/FormatConfigStep';
import CollectionFilterStep from '@/components/Export/CollectionFilterStep';
import ExportResultStep from '@/components/Export/ExportResultStep';
import { cn } from '@/lib/utils';

type ExportMode = 'zip' | 'data' | null;
type ExportStep = 'choose' | 'zip' | 'columns' | 'format' | 'filter' | 'result';

const LINE_DURATION = 0.25;

const getTargetWidth = (lineIndex: number, idx: number) => {
  if (lineIndex < idx) return '100%';
  if (lineIndex === idx) return '50%';
  return '0%';
};

const ZIP_STEPS: Step[] = [
  { id: 'choose', label: 'Mode', icon: Upload },
  { id: 'zip', label: 'Archive', icon: Archive },
  { id: 'result', label: 'Result', icon: FileCheck },
];

const DATA_STEPS: Step[] = [
  { id: 'choose', label: 'Mode', icon: Upload },
  { id: 'columns', label: 'Columns', icon: Columns },
  { id: 'format', label: 'Format', icon: Settings },
  { id: 'filter', label: 'Collections', icon: Filter },
  { id: 'result', label: 'Result', icon: FileCheck },
];

const Export: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useNavigationStore();

  const handleExitExport = useCallback(() => {
    goBack();
  }, [goBack]);

  const [mode, setMode] = useState<ExportMode>(null);
  const [currentStep, setCurrentStep] = useState<ExportStep>('choose');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'title', 'collection', 'creator', 'release_date', 'genre_ids', 'user_rating', 'progress_status', 'media_status',
  ]);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [delimiter, setDelimiter] = useState(';');
  const [ratingScale, setRatingScale] = useState(20);
  const [exportResult, setExportResult] = useState<{ path: string; size_bytes: number; exported_media?: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lineWidths, setLineWidths] = useState<string[]>([]);
  const prevIndexRef = useRef<number>(0);

  const { data: storageInfo } = useQuery({
    queryKey: ['storage-info'],
    queryFn: () => tauriApi.data.getStorageInfo(),
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: () => tauriApi.collections.getAll(),
  });

  const currentSteps = useMemo(() =>
    mode === 'zip' ? ZIP_STEPS : DATA_STEPS,
    [mode]
  );

  useEffect(() => {
    const steps = currentSteps;
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    const prev = prevIndexRef.current;

    if (lineWidths.length !== steps.length - 1) {
      setLineWidths(steps.slice(0, -1).map((_, i) => getTargetWidth(i, currentIndex)));
      prevIndexRef.current = currentIndex;
      return;
    }

    if (prev === currentIndex) return;
    const forward = currentIndex > prev;
    prevIndexRef.current = currentIndex;

    const timeouts: NodeJS.Timeout[] = [];
    setLineWidths(current => {
      const changing = steps.slice(0, -1)
        .map((_, i) => i)
        .filter(li => current[li] !== getTargetWidth(li, currentIndex));
      if (!forward) changing.reverse();
      changing.forEach((li, order) => {
        const timeoutId = setTimeout(() => {
          setLineWidths(s => {
            const next = [...s];
            next[li] = getTargetWidth(li, currentIndex);
            return next;
          });
        }, order * LINE_DURATION * 1000);
        timeouts.push(timeoutId);
      });
      return current;
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [currentStep, mode, lineWidths.length, currentSteps]);

  const handleStepClick = (stepId: string) => {
    const steps = currentSteps;
    const idx = steps.findIndex(s => s.id === stepId);
    const cur = steps.findIndex(s => s.id === currentStep);
    if (idx <= cur) setCurrentStep(stepId as ExportStep);
  };

  const handleGoBack = () => {
    if (currentStep === 'choose') {
      goBack();
    } else {
      setCurrentStep('choose');
      setMode(null);
      setExportResult(null);
      setExportError(null);
    }
  };

  const handleSuccess = (result: { path: string; size_bytes: number; exported_media?: number }) => {
    setExportResult(result);
    setExportError(null);
    setCurrentStep('result');
  };

  const handleError = (msg: string) => {
    setExportError(msg);
    setExportResult(null);
    setCurrentStep('result');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'choose':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{t('export.exportMode')}</h2>
              <p className="text-white/50 text-sm">{t('export.chooseExportType')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'zip' as ExportMode,
                  icon: Archive,
                  title: 'Archive ZIP',
                  subtitle: 'Sauvegarde & migration',
                  description: 'Sauvegarde complète de votre profil (base de données, images, paramètres). Idéal pour une sauvegarde périodique ou migrer sur une autre machine.',
                  features: ['✓ DB complète + paramètres', '✓ Images optionnelles', '✓ Restaurable via Import', '✓ Sauvegarde mensuelle'],
                  color: 'text-indigo-400',
                  border: 'border-indigo-500/50',
                  shadow: 'shadow-indigo-500/15',
                  bg: 'bg-indigo-400/5',
                  badge: 'Backup',
                  badgeColor: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
                },
                {
                  id: 'data' as ExportMode,
                  icon: FileText,
                  title: 'CSV / TSV / Markdown',
                  subtitle: 'Données brutes & interopérabilité',
                  description: 'Export de vos données en format ouvert pour analyse dans Excel, import dans une autre app, ou archivage lisible dans Obsidian / Notion.',
                  features: ['✓ Colonnes au choix', '✓ Compatible Excel / Sheets', '✓ Format Markdown', '✓ Échelle de note configurable'],
                  color: 'text-emerald-400',
                  border: 'border-emerald-500/50',
                  shadow: 'shadow-emerald-500/15',
                  bg: 'bg-emerald-400/5',
                  badge: 'Données',
                  badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                },
              ].map(opt => {
                const Icon = opt.icon;
                return (
                  <motion.button
                    key={opt.id}
                    onClick={() => { setMode(opt.id); setCurrentStep(opt.id === 'zip' ? 'zip' : 'columns'); }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn('text-left p-7 rounded-2xl border transition-all cursor-pointer glass-card border-white/5 hover:border-white/15 hover:shadow-lg group')}
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-colors')}>
                        <Icon className={cn('w-7 h-7', opt.color)} />
                      </div>
                      <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', opt.badgeColor)}>
                        {opt.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-0.5">{opt.title}</h3>
                    <p className={cn('text-sm font-medium mb-3', opt.color)}>{opt.subtitle}</p>
                    <p className="text-sm text-white/40 leading-relaxed mb-5">{opt.description}</p>
                    <ul className="space-y-1">
                      {opt.features.map((f, i) => (
                        <li key={i} className="text-xs text-white/30">{f}</li>
                      ))}
                    </ul>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );

      case 'zip':
        return (
          <ZipExportStep
            storageInfo={storageInfo ?? null}
            onSuccess={r => handleSuccess(r)}
            onError={handleError}
          />
        );

      case 'columns':
        return (
          <ColumnSelectionStep
            selectedColumns={selectedColumns}
            setSelectedColumns={setSelectedColumns}
            onNext={() => setCurrentStep('format')}
            onBack={handleGoBack}
          />
        );

      case 'format':
        return (
          <FormatConfigStep
            format={format}
            setFormat={setFormat}
            delimiter={delimiter}
            setDelimiter={setDelimiter}
            ratingScale={ratingScale}
            setRatingScale={setRatingScale}
            onNext={() => setCurrentStep('filter')}
            onBack={() => setCurrentStep('columns')}
          />
        );

      case 'filter':
        return (
          <CollectionFilterStep
            collections={collections}
            selectedColumns={selectedColumns}
            format={format}
            delimiter={delimiter}
            ratingScale={ratingScale}
            onSuccess={r => handleSuccess(r)}
            onError={handleError}
            onBack={() => setCurrentStep('format')}
          />
        );

      case 'result':
        return (
          <ExportResultStep
            exportType={mode === 'zip' ? 'zip' : 'csv'}
            result={exportResult}
            error={exportError}
            onRetry={handleGoBack}
            onBack={handleExitExport}
          />
        );

      default:
        return null;
    }
  };

  return (
    <AppShell>
      <SharedHeader activePage="export" disableLayoutAnimation={true} />
      <MainContent>
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{t('common.back')}</span>
        </button>

        {currentStep !== 'choose' && currentStep !== 'result' && (
          <div className="mb-8">
            <Stepper
              steps={currentSteps}
              currentStep={currentStep}
              onStepClick={handleStepClick}
              lineWidths={lineWidths}
            />
          </div>
        )}

        {currentStep === 'result' ? (
          renderStep()
        ) : (
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="w-full"
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        )}
      </MainContent>
    </AppShell>
  );
};

export default Export;
