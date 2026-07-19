import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Upload, Columns, Settings, Eye, FileCheck } from 'lucide-react';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { useQueryClient } from '@tanstack/react-query';
import { tauriApi } from '@/lib/tauri-api';
import { open } from '@tauri-apps/plugin-dialog';
import { AppShell, MainContent } from '@/components/Layout';
import SharedHeader from '@/components/SharedHeader';
import ColumnMappingStep from '@/components/Import/ColumnMappingStep';
import StatusMappingStep from '@/components/Import/StatusMappingStep';
import ConfigurationStep from '@/components/Import/ConfigurationStep';
import PreviewStep from '@/components/Import/PreviewStep';
import ResultStep from '@/components/Import/ResultStep';
import SeparatorSelectionStep from '@/components/Import/SeparatorSelectionStep';
import Stepper, { Step } from '@/components/Stepper';

type ImportType = 'zip' | 'csv' | null;
type ImportStep = 'upload' | 'separator_selection' | 'mapping' | 'status_mapping' | 'configuration' | 'preview' | 'importing' | 'result';

const LINE_DURATION = 0.25;

const getTargetWidth = (lineIndex: number, idx: number) => {
  if (lineIndex < idx) return '100%';
  if (lineIndex === idx) return '50%';
  return '0%';
};

const Import: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useNavigationStore();
  const queryClient = useQueryClient();

  const [importType, setImportType] = useState<ImportType>(null);
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [importState, setImportState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [csvFilePath, setCsvFilePath] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mediaStatusMapping, setMediaStatusMapping] = useState<Record<string, string>>({});
  const [progressStatusMapping, setProgressStatusMapping] = useState<Record<string, string>>({});
  const [ratingScale, setRatingScale] = useState<number>(20);
  const [autoCreateCollections, setAutoCreateCollections] = useState<boolean>(true);
  const [autoCreateGenres, setAutoCreateGenres] = useState<boolean>(true);
  const [genreSeparator, setGenreSeparator] = useState<string>(',');
  const [roundRatings, setRoundRatings] = useState<boolean>(true);
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [zipFilePath, setZipFilePath] = useState<string | null>(null);
  const [mergeZip, setMergeZip] = useState<boolean>(true);
  const [skipDuplicatesZip, setSkipDuplicatesZip] = useState<boolean>(true);

  const [lineWidths, setLineWidths] = useState<string[]>([]);
  const prevIndexRef = useRef<number>(0);

  // Define steps for ZIP import
  const zipSteps: Step[] = useMemo(() => [
    { id: 'upload', label: 'Import fichier', icon: Upload },
    { id: 'result', label: 'Résultat', icon: FileCheck },
  ], []);

  // Define steps for CSV import
  const csvSteps: Step[] = useMemo(() => [
    { id: 'upload', label: 'Import fichier', icon: Upload },
    { id: 'separator_selection', label: 'Séparateur', icon: Settings },
    { id: 'mapping', label: 'Mapping', icon: Columns },
    { id: 'status_mapping', label: 'Statuts', icon: Settings },
    { id: 'configuration', label: 'Configuration', icon: Settings },
    { id: 'preview', label: 'Prévisualisation', icon: Eye },
    { id: 'result', label: 'Résultat', icon: FileCheck },
  ], []);

  // Initialize lineWidths and handle sequential animation
  useEffect(() => {
    if (currentStep === 'importing') return; // Ignore this step completely

    const currentSteps = importType === 'zip' ? zipSteps : csvSteps;
    const currentIndex = currentSteps.findIndex((step) => step.id === currentStep);
    const prev = prevIndexRef.current;

    // Initialisation au montage ou changement de liste de steps (zip ↔ csv)
    if (lineWidths.length !== currentSteps.length - 1) {
      setLineWidths(currentSteps.slice(0, -1).map((_, i) => getTargetWidth(i, currentIndex)));
      prevIndexRef.current = currentIndex;
      return;
    }

    if (prev === currentIndex) return;

    const forward = currentIndex > prev;
    prevIndexRef.current = currentIndex;

    setLineWidths((current) => {
      const changing = currentSteps.slice(0, -1)
        .map((_, i) => i)
        .filter((lineIndex) => current[lineIndex] !== getTargetWidth(lineIndex, currentIndex));

      if (!forward) changing.reverse();

      changing.forEach((lineIndex, order) => {
        setTimeout(() => {
          setLineWidths((s) => {
            const next = [...s];
            next[lineIndex] = getTargetWidth(lineIndex, currentIndex);
            return next;
          });
        }, order * LINE_DURATION * 1000);
      });

      return current;
    });
  }, [currentStep, importType, lineWidths.length, zipSteps, csvSteps]);

  // Get current steps based on import type (default to CSV steps before file selection)
  const currentSteps = importType === 'zip' ? zipSteps : csvSteps;

  // Handle step click (only allow going back to previous steps)
  const handleStepClick = (stepId: string) => {
    const stepIndex = currentSteps.findIndex((step) => step.id === stepId);
    const currentIndex = currentSteps.findIndex((step) => step.id === currentStep);
    
    // Only allow clicking on completed or current steps
    if (stepIndex <= currentIndex) {
      setCurrentStep(stepId as ImportStep);
    }
  };


  const handleGoBack = () => {
    if (currentStep === 'upload') {
      if (zipFilePath) {
        setImportType(null);
        setZipFilePath(null);
        setImportState('idle');
        setError(null);
      } else {
        goBack();
      }
    } else {
      setCurrentStep('upload');
      setImportType(null);
      setImportState('idle');
      setImportResult(null);
      setError(null);
      setCsvPreview(null);
      setCsvFilePath(null);
      setZipFilePath(null);
      setColumnMapping({});
      setMediaStatusMapping({});
      setProgressStatusMapping({});
      setCsvDelimiter(',');
    }
  };

  const handleFileUpload = async () => {
    setImportState('loading');
    setError(null);
    try {
      const sourcePath = await open({
        multiple: false,
        filters: [{ name: 'Fichiers supportés', extensions: ['zip', 'csv'] }],
      });

      if (!sourcePath) {
        setImportState('idle');
        return;
      }

      const filePath = sourcePath as string;
      const extension = filePath.split('.').pop()?.toLowerCase();

      if (extension === 'zip') {
        setImportType('zip');
        setZipFilePath(filePath);
        setImportState('idle');
      } else if (extension === 'csv') {
        setImportType('csv');
        setCsvFilePath(filePath);
        setImportState('idle');
        setCurrentStep('separator_selection');
      } else {
        setImportState('error');
        setError('Format non supporté. Veuillez sélectionner un fichier .zip ou .csv.');
      }
    } catch (e) {
      setImportState('error');
      setError(String(e));
      setCurrentStep('result');
    }
  };

  const handleZipImport = async () => {
    if (!zipFilePath) return;
    setImportState('loading');
    setError(null);
    try {
      setCurrentStep('importing');
      const result = await tauriApi.data.importDatabase(zipFilePath, mergeZip, skipDuplicatesZip);
      setImportResult(result);
      setImportState('success');
      setCurrentStep('result');
      queryClient.invalidateQueries();
    } catch (e) {
      setImportState('error');
      setError(String(e));
      setCurrentStep('result');
    }
  };

  const handleCsvImport = async () => {
    if (!csvFilePath) return;

    setImportState('loading');
    setError(null);
    try {
      setCurrentStep('importing');

      // Normalize column mapping: strip index suffixes from IDs (e.g., "Nom-0" -> "Nom")
      const normalizedMapping: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([field, columnId]) => {
        if (columnId) {
          normalizedMapping[field] = columnId.replace(/-\d+$/, '');
        }
      });

      const result = await tauriApi.data.importFromCsv({
        file_path: csvFilePath,
        column_mapping: normalizedMapping,
        status_mapping: { ...mediaStatusMapping, ...progressStatusMapping },
        rating_scale: ratingScale,
        auto_create_collections: autoCreateCollections,
        auto_create_genres: autoCreateGenres,
        genre_separator: genreSeparator,
        round_ratings: roundRatings,
        delimiter: csvDelimiter,
      });
      setImportResult(result);
      setImportState('success');
      setCurrentStep('result');
      queryClient.invalidateQueries();
    } catch (e) {
      setImportState('error');
      setError(String(e));
      setCurrentStep('result');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'separator_selection':
        return (
          <SeparatorSelectionStep
            csvDelimiter={csvDelimiter}
            setCsvDelimiter={setCsvDelimiter}
            onNext={async () => {
              setImportState('loading');
              setError(null);
              try {
                const preview = await tauriApi.data.previewCsvImport(csvFilePath!, csvDelimiter);
                setCsvPreview(preview);
                setImportState('idle');
                setCurrentStep('mapping');
              } catch (e) {
                setImportState('error');
                setError(String(e));
              }
            }}
            onBack={handleGoBack}
          />
        );

      case 'mapping':
        return (
          <ColumnMappingStep
            csvColumns={csvPreview?.columns || []}
            sampleRows={csvPreview?.all_rows || []}
            columnMapping={columnMapping}
            setColumnMapping={setColumnMapping}
            onNext={() => setCurrentStep('status_mapping')}
            onBack={handleGoBack}
          />
        );

      case 'status_mapping':
        return (
          <StatusMappingStep
            csvPreview={csvPreview}
            columnMapping={columnMapping}
            mediaStatusMapping={mediaStatusMapping}
            setMediaStatusMapping={setMediaStatusMapping}
            progressStatusMapping={progressStatusMapping}
            setProgressStatusMapping={setProgressStatusMapping}
            onNext={() => setCurrentStep('configuration')}
            onBack={() => setCurrentStep('mapping')}
          />
        );

      case 'configuration':
        return (
          <ConfigurationStep
            ratingScale={ratingScale}
            setRatingScale={setRatingScale}
            autoCreateCollections={autoCreateCollections}
            setAutoCreateCollections={setAutoCreateCollections}
            autoCreateGenres={autoCreateGenres}
            setAutoCreateGenres={setAutoCreateGenres}
            genreSeparator={genreSeparator}
            setGenreSeparator={setGenreSeparator}
            roundRatings={roundRatings}
            setRoundRatings={setRoundRatings}
            onBack={() => setCurrentStep('mapping')}
            onNext={() => setCurrentStep('preview')}
          />
        );

      case 'preview':
        return (
          <PreviewStep
            csvPreview={csvPreview}
            columnMapping={columnMapping}
            onBack={() => setCurrentStep('configuration')}
            onImport={handleCsvImport}
          />
        );

      case 'upload':
        if (importType === 'zip' && zipFilePath) {
          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-2xl font-bold text-white mb-6">{t('import.importFile')}</h2>
              <div className="glass-card p-8 rounded-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider">{t('import.previewTitle')}</p>
                    <p className="text-sm font-semibold text-white mt-1">{t('import.logiaBackup')}</p>
                    <p className="text-xs text-white/30 font-mono mt-0.5 truncate max-w-md">{zipFilePath}</p>
                  </div>
                  <button
                    onClick={() => {
                      setImportType(null);
                      setZipFilePath(null);
                    }}
                    className="text-xs text-white/40 hover:text-white transition-colors border border-white/10 rounded-lg px-3 py-1.5 hover:bg-white/5 cursor-pointer"
                  >
                    {t('common.back')}
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-white">{t('import.importModeLabel')}</p>
                  
                  {/* Mode Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setMergeZip(false)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        !mergeZip
                          ? 'bg-primary/10 border-primary/40 text-white shadow-lg shadow-primary/15'
                          : 'bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/[0.05]'
                      }`}
                    >
                      <p className="text-sm font-semibold">{t('import.overwriteOption')}</p>
                    </button>
                    <button
                      onClick={() => setMergeZip(true)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        mergeZip
                          ? 'bg-primary/10 border-primary/40 text-white shadow-lg shadow-primary/15'
                          : 'bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/[0.05]'
                      }`}
                    >
                      <p className="text-sm font-semibold">{t('import.mergeOption')}</p>
                    </button>
                  </div>

                  {/* Skip duplicates toggle (only if merging) */}
                  {mergeZip && (
                    <div className="flex items-center gap-2 pt-2 animate-in fade-in slide-in-from-top-2">
                      <button
                        onClick={() => setSkipDuplicatesZip(!skipDuplicatesZip)}
                        className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                          skipDuplicatesZip ? 'bg-primary' : 'bg-white/10'
                        }`}
                        style={{ height: 18, width: 32 }}
                      >
                        <div
                          className="absolute top-0.5 w-[14px] h-[14px] rounded-full bg-white shadow-md transition-transform"
                          style={{ left: skipDuplicatesZip ? 15 : 2 }}
                        />
                      </button>
                      <span className="text-xs text-white/60">
                        {t('import.skipDuplicates')}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleZipImport}
                  className="w-full bg-primary hover:bg-primary/80 text-white py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t('import.importFile')}</span>
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">{t('import.importFile')}</h2>
            <div className="glass-card p-8 rounded-2xl">
              <p className="text-white/60 text-sm mb-4">
                {t('import.selectFileHint')}
              </p>
              <button
                onClick={handleFileUpload}
                className="w-full border-2 border-dashed border-white/10 rounded-xl p-12 text-center hover:border-primary/50 hover:bg-white/5 transition-all cursor-pointer"
              >
                <Upload className="w-12 h-12 text-white/30 mx-auto mb-4" />
                <p className="text-white/40 text-sm">{t('import.clickToSelect')}</p>
              </button>
              {error && importState === 'error' && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'importing':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">{t('import.importInProgress')}</h2>
            <div className="glass-card p-8 rounded-2xl text-center">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-white/60 text-sm">
                {importType === 'zip' ? t('import.importingDatabase') : t('import.importingData')}
              </p>
            </div>
          </div>
        );

      case 'result':
        return (
          <ResultStep
            importState={importState}
            importType={importType}
            importResult={importResult}
            error={error}
            onGoToLibrary={() => {
              const { navigate } = useNavigationStore.getState();
              navigate('library');
            }}
            onGoBack={goBack}
            onRetry={handleGoBack}
          />
        );

      default:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Étape en développement</h2>
            <div className="glass-card p-8 rounded-2xl">
              <p className="text-white/60 text-sm">
                Cette étape sera implémentée prochainement.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <AppShell>
      <SharedHeader activePage="import" />
      
      <MainContent>
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">{t('common.back')}</span>
        </button>

        {/* Stepper - always show, not during importing */}
        {currentStep !== 'importing' && (
          <div className="mb-8">
            <Stepper
              steps={currentSteps}
              currentStep={currentStep}
              onStepClick={handleStepClick}
              lineWidths={lineWidths}
            />
          </div>
        )}

        {renderStep()}
      </MainContent>
    </AppShell>
  );
};

export default Import;
