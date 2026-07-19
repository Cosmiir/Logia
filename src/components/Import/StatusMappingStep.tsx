import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface StatusMappingStepProps {
  csvPreview: any;
  columnMapping: Record<string, string>;
  mediaStatusMapping: Record<string, string>;
  setMediaStatusMapping: (mapping: Record<string, string>) => void;
  progressStatusMapping: Record<string, string>;
  setProgressStatusMapping: (mapping: Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}

const LOGIA_STATUSES = [
  { value: 'upcoming', labelKey: 'status.mediaStatus.UPCOMING', color: '#818cf8', icon: '📅' },
  { value: 'ongoing', labelKey: 'status.mediaStatus.ONGOING', color: '#0ea5e9', icon: '▶️' },
  { value: 'completed', labelKey: 'status.mediaStatus.COMPLETED', color: '#10b981', icon: '✅' },
  { value: 'abandoned', labelKey: 'status.mediaStatus.ABANDONED', color: '#f43f5e', icon: '❌' },
];

const StatusMappingStep: React.FC<StatusMappingStepProps> = ({
  csvPreview,
  columnMapping,
  mediaStatusMapping,
  setMediaStatusMapping,
  progressStatusMapping,
  setProgressStatusMapping,
  onBack,
  onNext,
}) => {
  const { t } = useTranslation();
  // Helper function to extract unique values from a column
  const extractUniqueValues = useMemo(() => {
    return (columnKey: string) => {
      const statusColumn = columnMapping[columnKey];
      if (!statusColumn) return [];

      const columns = csvPreview?.columns || [];
      const allRows = csvPreview?.all_rows || [];

      const colIndex = columns.findIndex((col: string) => {
        const normalizedCol = col.replace(/-\d+$/, '');
        const normalizedMapping = statusColumn.replace(/-\d+$/, '');
        return normalizedCol === normalizedMapping;
      });

      if (colIndex === -1) return [];

      const statusSet = new Set<string>();
      allRows.forEach((row: string[]) => {
        const value = row[colIndex]?.trim();
        if (value) statusSet.add(value);
      });

      return Array.from(statusSet).sort();
    };
  }, [csvPreview, columnMapping]);

  // Extract unique values for media_status and progress_status
  const uniqueMediaStatuses = extractUniqueValues('media_status');
  const uniqueProgressStatuses = extractUniqueValues('progress_status');

  // Auto-map statuses based on patterns
  const autoMapStatuses = (statuses: string[]) => {
    const newMapping: Record<string, string> = {};

    statuses.forEach((status: string) => {
      const normalized = status.toUpperCase();
      let mappedValue: string | null = null;

      if (['FINI', 'TERMINÉ', 'COMPLETED', 'DONE', 'FINISH'].some(v => normalized.includes(v))) {
        mappedValue = 'completed';
      } else if (['EN COURS', 'ENCOURS', 'ONGOING', 'PROGRESS', 'CURRENT'].some(v => normalized.includes(v))) {
        mappedValue = 'ongoing';
      } else if (['À VOIR', 'A VOIR', 'A COMMENCER', 'ACOMMENCER', 'UPCOMING', 'TO WATCH', 'TODO', 'PLAN'].some(v => normalized.includes(v))) {
        mappedValue = 'upcoming';
      } else if (['ABANDONNÉ', 'ABANDONNE', 'ABANDONED', 'DROPPED', 'STOP'].some(v => normalized.includes(v))) {
        mappedValue = 'abandoned';
      }

      if (mappedValue) {
        newMapping[status] = mappedValue;
      }
    });

    return newMapping;
  };

  const autoMapMediaStatuses = () => {
    setMediaStatusMapping(autoMapStatuses(uniqueMediaStatuses));
  };

  const autoMapProgressStatuses = () => {
    setProgressStatusMapping(autoMapStatuses(uniqueProgressStatuses));
  };

  // Auto-map on mount if no mapping exists
  React.useEffect(() => {
    if (uniqueMediaStatuses.length > 0 && Object.keys(mediaStatusMapping).length === 0) {
      setMediaStatusMapping(autoMapStatuses(uniqueMediaStatuses));
    }
    if (uniqueProgressStatuses.length > 0 && Object.keys(progressStatusMapping).length === 0) {
      setProgressStatusMapping(autoMapStatuses(uniqueProgressStatuses));
    }
  }, [uniqueMediaStatuses, uniqueProgressStatuses]);

  const StatusDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
  }> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const current = LOGIA_STATUSES.find(s => s.value === value);

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-all min-w-[140px]"
        >
          {current ? (
            <>
              <span className="text-lg">{current.icon}</span>
              <span className="text-white font-medium">{t(current.labelKey)}</span>
            </>
          ) : (
            <span className="text-white/40">{t('import.notMapped')}</span>
          )}
          <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 w-full mt-2 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden"
            >
              {LOGIA_STATUSES.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => {
                    onChange(status.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    value === status.value
                      ? 'bg-primary/10 text-primary'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{status.icon}</span>
                  <span className={value === status.value ? 'font-medium' : ''}>{t(status.labelKey)}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const hasUnmappedMedia = uniqueMediaStatuses.some(s => !mediaStatusMapping[s]);
  const hasUnmappedProgress = uniqueProgressStatuses.some(s => !progressStatusMapping[s]);

  const StatusColumn: React.FC<{
    title: string;
    columnKey: string;
    statuses: string[];
    mapping: Record<string, string>;
    setMapping: (mapping: Record<string, string>) => void;
    onAutoMap: () => void;
  }> = ({ title, columnKey, statuses, mapping, setMapping, onAutoMap }) => {
    if (!columnMapping[columnKey]) {
      return (
        <div className="glass-card rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/40 text-sm">
            {t('import.columnNotMapped', { title })}
          </p>
        </div>
      );
    }

    if (statuses.length === 0) {
      return (
        <div className="glass-card rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-white/40 text-sm">
            {t('import.noStatusValues')}
          </p>
        </div>
      );
    }

    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-white/40">{t('import.statusValuesDetected', { count: statuses.length })}</p>
          </div>
          <button
            onClick={onAutoMap}
            className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-xs"
          >
            {t('common.autoDetect')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                <th className="text-left py-3 px-4 text-xs font-semibold text-white/35 uppercase tracking-wider">
                  {t('import.sourceValue')}
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-white/35 uppercase tracking-wider w-[200px]">
                  {t('import.logiaStatus')}
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-white/35 uppercase tracking-wider">
                  {t('common.preview')}
                </th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((status) => {
                const mappedValue = mapping[status];
                const mappedStatus = LOGIA_STATUSES.find(s => s.value === mappedValue);

                return (
                  <tr
                    key={status}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white/80 bg-white/5 px-2 py-1 rounded text-xs">
                          {status}
                        </span>
                        {!mappedValue && (
                          <span className="text-xs text-amber-400">{t('import.notMapped')}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusDropdown
                        value={mappedValue || ''}
                        onChange={(value) => {
                          setMapping({
                            ...mapping,
                            [status]: value,
                          });
                        }}
                      />
                    </td>
                    <td className="py-3 px-4">
                      {mappedStatus ? (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{mappedStatus.icon}</span>
                          <span className="text-white/60">{t(mappedStatus.labelKey)}</span>
                        </div>
                      ) : (
                        <span className="text-white/30 italic">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{t('import.statusMappingTitle')}</h2>
          <p className="text-white/60 text-sm">
            {t('import.statusMappingDescription')}
          </p>
        </div>
      </div>

      {!columnMapping['media_status'] && !columnMapping['progress_status'] ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white/60 text-sm mb-2">
            {t('import.noStatusColumnMapped')}
          </p>
          <p className="text-white/40 text-xs">
            {t('import.statusMappingOptional')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusColumn
            title={t('common.mediaStatus')}
            columnKey="media_status"
            statuses={uniqueMediaStatuses}
            mapping={mediaStatusMapping}
            setMapping={setMediaStatusMapping}
            onAutoMap={autoMapMediaStatuses}
          />
          <StatusColumn
            title={t('common.progressStatus')}
            columnKey="progress_status"
            statuses={uniqueProgressStatuses}
            mapping={progressStatusMapping}
            setMapping={setProgressStatusMapping}
            onAutoMap={autoMapProgressStatuses}
          />
        </div>
      )}

      <div className="flex justify-between items-center pt-2">
        <div className="text-sm text-white/50">
          {t('import.statusValuesDetected', { count: uniqueMediaStatuses.length + uniqueProgressStatuses.length })}
          {(hasUnmappedMedia || hasUnmappedProgress) && <span className="text-amber-400 ml-2">• {t('import.unmapped')}</span>}
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-5 py-2.5 text-sm text-white/50 hover:text-white transition-colors cursor-pointer">
            {t('common.back')}
          </button>
          <button
            onClick={onNext}
            className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm rounded-lg transition-all cursor-pointer shadow-lg shadow-primary/25 flex items-center gap-2"
          >
            {t('common.next')} <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusMappingStep;
